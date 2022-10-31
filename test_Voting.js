const { BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const expect = require('chai').expect;
const Voting = artifacts.require("Voting");

const prepareVotes = async (owner, accounts, votingInstance) => {
    await votingInstance.addVoter(accounts[1], { from: owner });
    await votingInstance.addVoter(accounts[2], { from: owner });
    await votingInstance.addVoter(accounts[3], { from: owner });

    await votingInstance.startProposalsRegistering({ from: owner });
    await votingInstance.addProposal("proposal1", { from: accounts[1] });
    await votingInstance.addProposal("proposal2", { from: accounts[1] });
    await votingInstance.addProposal("proposal3", { from: accounts[1] });

    await votingInstance.endProposalsRegistering({ from: owner });
    await votingInstance.startVotingSession({ from: owner });

    await votingInstance.setVote(1, { from: accounts[1] })
    await votingInstance.setVote(2, { from: accounts[2] })
    await votingInstance.setVote(3, { from: accounts[3] })

    await votingInstance.endVotingSession({ from: owner });
}


contract("Voting - Deployment", accounts => {

    before(async function () {
        this.voting = await Voting.new();
    });

    it("sets the right session status", async function () {
        const owner = accounts[0];
        expect(await this.voting.workflowStatus.call()).to.be.bignumber.equal(new BN(0));
    });

    it("sets the right owner", async function () {
        expect(await this.voting.owner.call()).to.equal(accounts[0]);
    });

});



// ::::::::::::: GETTERS ::::::::::::: //


contract("Voting - getVoter", accounts => {

    before(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
        await prepareVotes(this.owner, accounts, this.voting);

    });

    it("retrieves the vote of a given address if registred", async function () {
        voter = await this.voting.getVoter(accounts[1], { from: accounts[1] })
        expect(voter.votedProposalId).to.be.bignumber.equal(new BN(2));
        expect(voter.hasVoted).to.be.equal(true);
    });

    it("fails if called by a non registred address", async function () {
        await expectRevert(this.voting.getVoter(accounts[1], { from: accounts[4] }), "You're not a voter");
    });
});

contract("Voting - getOneProposal", accounts => {

    before(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
        await this.voting.addVoter(accounts[1], { from: this.owner });

        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.addProposal("proposal1", { from: accounts[1] });
        await this.voting.addProposal("proposal2", { from: accounts[1] });
    });

    it("retrieves the proposal of a given proposalId", async function () {
        proposal = await this.voting.getOneProposal(2, { from: accounts[1] })
        expect(proposal.description).to.be.equal('proposal2');
        expect(proposal.voteCount).to.be.bignumber.equal(new BN(0));

    });

    it("fails if called by a non registred address", async function () {
        await expectRevert(this.voting.getVoter(accounts[1], { from: accounts[4] }), "You're not a voter");
    });
});



// ::::::::::::: REGISTRATION ::::::::::::: //


contract("Voting - addVoter", accounts => {

    before(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("registers a new address", async function () {
        const receipt = await this.voting.addVoter(accounts[1], { from: this.owner });
        const voter = await this.voting.getVoter.call(accounts[1], { from: accounts[1] });
        expect(await voter.isRegistered).to.equal(true);
        expect(await voter.hasVoted).to.equal(false);
        expect(await voter.votedProposalId).to.bignumber.equal(new BN(0));

        expectEvent(receipt, "VoterRegistered", { voterAddress: accounts[1] });

    });

    it("reverts if register is not owner", async function () {
        await expectRevert(this.voting.addVoter(accounts[1], { from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("reverts if voter already registred", async function () {
        await expectRevert(this.voting.addVoter(accounts[1], { from: this.owner }), "Already registered");
    });

    // we are already at registration session 
    it("fails if not at registration session", async function () {
        const sessionFunctions = [this.voting.startProposalsRegistering, this.voting.endProposalsRegistering, this.voting.startVotingSession,
        this.voting.endVotingSession, this.voting.tallyVotes]
        for (let i = 0; i < sessionFunctions.length; i++) {
            await sessionFunctions[i]({ from: this.owner });
            await expectRevert(this.voting.addVoter(accounts[1], { from: this.owner }), "Voters registration is not open yet");
        }
    });
});


// ::::::::::::: PROPOSAL ::::::::::::: //

contract("Voting - addProposal", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("proposes new proposals", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });
        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.addProposal("proposal1", { from: accounts[1] });
        await this.voting.addProposal("proposal2", { from: accounts[1] });
        const proposal1 = await this.voting.getOneProposal(1, { from: accounts[1] });
        const proposal2 = await this.voting.getOneProposal(2, { from: accounts[1] });
        expect(proposal1.description).to.equal("proposal1");
        expect(proposal2.description).to.equal("proposal2");
    });

    it("emits a ProposalEvent and WorkflowStatusChange", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });
        await this.voting.startProposalsRegistering({ from: this.owner });

        expectEvent(await this.voting.addProposal("proposal1", { from: accounts[1] }), "ProposalRegistered", { proposalId: '1' });

    });

    it("fails if not a registred address", async function () {
        await this.voting.startProposalsRegistering({ from: this.owner });
        await expectRevert(this.voting.addProposal("proposal1", { from: accounts[1] }), "You're not a voter");
    });

    it("fails if proposal is empty", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });
        await this.voting.startProposalsRegistering({ from: this.owner });

        await expectRevert(this.voting.addProposal("", { from: accounts[1] }), "Vous ne pouvez pas ne rien proposer");
    });

    it("fails if not at proposal session", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });

        await expectRevert(this.voting.addProposal("proposal1", { from: accounts[1] }), "Proposals are not allowed yet");

        // proposal session
        await this.voting.startProposalsRegistering({ from: this.owner });
        const sessionFunctions = [this.voting.endProposalsRegistering, this.voting.startVotingSession,
        this.voting.endVotingSession, this.voting.tallyVotes]
        for (let i = 0; i < sessionFunctions.length; i++) {
            await sessionFunctions[i]({ from: this.owner });
            await expectRevert(this.voting.addProposal("proposal1", { from: accounts[1] }), "Proposals are not allowed yet");
        }
    });
});


// ::::::::::::: VOTE ::::::::::::: //

contract("Voting - setVote", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    const prepareVoteSession = async (accounts, votingInstance, owner) => {
        await votingInstance.addVoter(accounts[1], { from: owner });
        await votingInstance.startProposalsRegistering({ from: owner });
        await votingInstance.addProposal("proposal1", { from: accounts[1] });
        await votingInstance.endProposalsRegistering({ from: owner });
        await votingInstance.startVotingSession({ from: owner });
    }

    it("votes for proposals", async function () {
        await prepareVoteSession(accounts, this.voting, this.owner);

        await this.voting.setVote(1, { from: accounts[1] });

        const proposal = await this.voting.getOneProposal(1, { from: accounts[1] });
        const voter = await this.voting.getVoter(accounts[1], { from: accounts[1] });

        expect(proposal.voteCount).to.be.bignumber.equal(new BN(1));
        expect(voter.hasVoted).to.be.true;
        expect(voter.votedProposalId).to.be.bignumber.equal(new BN(1));

    });

    it("reverts when voting for bad proposalId", async function () {
        await prepareVoteSession(accounts, this.voting, this.owner);

        await expectRevert(this.voting.setVote(2, { from: accounts[1] }), "Proposal not found");

    });

    it("Should be reverted when already voted", async function () {
        await prepareVoteSession(accounts, this.voting, this.owner);

        await this.voting.setVote(1, { from: accounts[1] });
        await expectRevert(this.voting.setVote(1, { from: accounts[1] }), "You have already voted");

    });

    it("Should be revert when voter is not registered", async function () {
        await prepareVoteSession(accounts, this.voting, this.owner);

        await expectRevert(this.voting.setVote(1, { from: accounts[2] }), "You're not a voter");

    });

    it("Should emit Voted event", async function () {
        await prepareVoteSession(accounts, this.voting, this.owner);

        expectEvent(await this.voting.setVote(1, { from: accounts[1] }), "Voted", { voter: accounts[1], proposalId: new BN(1) });
    });

    it("reverts if not at vote session", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });

        await expectRevert(this.voting.setVote(1, { from: accounts[1] }), "Voting session havent started yet");

        let sessionFunctions = [this.voting.startProposalsRegistering, this.voting.endProposalsRegistering]
        for (let i = 0; i < sessionFunctions.length; i++) {
            await sessionFunctions[i]({ from: this.owner });
            await expectRevert(this.voting.setVote(1, { from: accounts[1] }), "Voting session havent started yet");
        }

        await this.voting.startVotingSession({ from: this.owner });
        sessionFunctions = [this.voting.endVotingSession, this.voting.tallyVotes]
        for (let i = 0; i < sessionFunctions.length; i++) {
            await sessionFunctions[i]({ from: this.owner });
            await expectRevert(this.voting.setVote(1, { from: accounts[1] }), "Voting session havent started yet");
        }
    });


});


// ::::::::::::: STATES ::::::::::::: //

contract("Voting - startProposalsRegistering", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("reverts if not owner ", async function () {
        await expectRevert(this.voting.startProposalsRegistering({ from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("registration has started correctly", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });
        let event = await this.voting.startProposalsRegistering({ from: this.owner });
        expect(await this.voting.workflowStatus.call()).to.be.bignumber.equal(new BN(1));

        expectEvent(event, "WorkflowStatusChange", { previousStatus: new BN(0), newStatus: new BN(1) });

        proposal = await this.voting.getOneProposal(0, { from: accounts[1] })
        expect(proposal.description).to.be.equal('GENESIS');
        expect(proposal.voteCount).to.be.bignumber.equal(new BN(0));
    });

    it("reverts if not at RegisteringVoters status", async function () {
        await this.voting.startProposalsRegistering({ from: this.owner });

        await expectRevert(this.voting.startProposalsRegistering({ from: this.owner }), "Registering proposals cant be started now");

        await this.voting.endProposalsRegistering({ from: this.owner })
        await expectRevert(this.voting.startProposalsRegistering({ from: this.owner }), "Registering proposals cant be started now");

        await this.voting.startVotingSession({ from: this.owner })
        await expectRevert(this.voting.startProposalsRegistering({ from: this.owner }), "Registering proposals cant be started now");

        await this.voting.endVotingSession({ from: this.owner })
        await expectRevert(this.voting.startProposalsRegistering({ from: this.owner }), "Registering proposals cant be started now");

        await this.voting.tallyVotes({ from: this.owner })
        await expectRevert(this.voting.startProposalsRegistering({ from: this.owner }), "Registering proposals cant be started now");
    });
});

contract("Voting - endProposalsRegistering", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("reverts if not owner ", async function () {
        await expectRevert(this.voting.endProposalsRegistering({ from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("registration has ended correctly", async function () {
        await this.voting.startProposalsRegistering({ from: this.owner });
        let event = await this.voting.endProposalsRegistering({ from: this.owner });
        expect(await this.voting.workflowStatus.call()).to.be.bignumber.equal(new BN(2));

        expectEvent(event, "WorkflowStatusChange", { previousStatus: new BN(1), newStatus: new BN(2) });
    });

    it("reverts if not at ProposalsRegistrationStarted status", async function () {
        await expectRevert(this.voting.endProposalsRegistering({ from: this.owner }), "Registering proposals havent started yet");

        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.endProposalsRegistering({ from: this.owner })

        await expectRevert(this.voting.endProposalsRegistering({ from: this.owner }), "Registering proposals havent started yet");

        await this.voting.startVotingSession({ from: this.owner })
        await expectRevert(this.voting.endProposalsRegistering({ from: this.owner }), "Registering proposals havent started yet");

        await this.voting.endVotingSession({ from: this.owner })
        await expectRevert(this.voting.endProposalsRegistering({ from: this.owner }), "Registering proposals havent started yet");

        await this.voting.tallyVotes({ from: this.owner })
        await expectRevert(this.voting.endProposalsRegistering({ from: this.owner }), "Registering proposals havent started yet");
    });
});

contract("Voting - startVotingSession", accounts => {


    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("reverts if not owner ", async function () {
        await expectRevert(this.voting.startVotingSession({ from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("voting session has started correctly", async function () {
        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.endProposalsRegistering({ from: this.owner });

        let event = await this.voting.startVotingSession({ from: this.owner });

        expect(await this.voting.workflowStatus.call()).to.be.bignumber.equal(new BN(3));

        expectEvent(event, "WorkflowStatusChange", { previousStatus: new BN(2), newStatus: new BN(3) });
    });

    it("reverts if not at ProposalsRegistrationEnded status", async function () {
        await expectRevert(this.voting.startVotingSession({ from: this.owner }), "Registering proposals phase is not finished");

        await this.voting.startProposalsRegistering({ from: this.owner });
        await expectRevert(this.voting.startVotingSession({ from: this.owner }), "Registering proposals phase is not finished");

        await this.voting.endProposalsRegistering({ from: this.owner });
        await this.voting.startVotingSession({ from: this.owner })

        await expectRevert(this.voting.startVotingSession({ from: this.owner }), "Registering proposals phase is not finished");

        await this.voting.endVotingSession({ from: this.owner })
        await expectRevert(this.voting.startVotingSession({ from: this.owner }), "Registering proposals phase is not finished");

        await this.voting.tallyVotes({ from: this.owner })
        await expectRevert(this.voting.startVotingSession({ from: this.owner }), "Registering proposals phase is not finished");
    });
});

contract("Voting - endVotingSession", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("reverts if not owner ", async function () {
        await expectRevert(this.voting.endVotingSession({ from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("voting session has ended correctly", async function () {
        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.endProposalsRegistering({ from: this.owner });
        await this.voting.startVotingSession({ from: this.owner });
        let event = await this.voting.endVotingSession({ from: this.owner });

        expect(await this.voting.workflowStatus.call()).to.be.bignumber.equal(new BN(4));
        expectEvent(event, "WorkflowStatusChange", { previousStatus: new BN(3), newStatus: new BN(4) });
    });

    it("reverts if not at VotingSessionStarted status", async function () {
        await expectRevert(this.voting.endVotingSession({ from: this.owner }), "Voting session havent started yet");

        await this.voting.startProposalsRegistering({ from: this.owner });
        await expectRevert(this.voting.endVotingSession({ from: this.owner }), "Voting session havent started yet");

        await this.voting.endProposalsRegistering({ from: this.owner });
        await expectRevert(this.voting.endVotingSession({ from: this.owner }), "Voting session havent started yet");

        await this.voting.startVotingSession({ from: this.owner });
        await this.voting.endVotingSession({ from: this.owner })

        await expectRevert(this.voting.endVotingSession({ from: this.owner }), "Voting session havent started yet");

        await this.voting.tallyVotes({ from: this.owner })
        await expectRevert(this.voting.endVotingSession({ from: this.owner }), "Voting session havent started yet");
    });
});

contract("Voting - tallyVotes", accounts => {

    beforeEach(async function () {
        this.voting = await Voting.new();
        this.owner = accounts[0];
    });

    it("reverts if not owner", async function () {
        await expectRevert(this.voting.tallyVotes({ from: accounts[1] }), "Ownable: caller is not the owner");
    });

    it("computes the right winner proposal", async function () {
        await this.voting.addVoter(accounts[1], { from: this.owner });
        await this.voting.addVoter(accounts[2], { from: this.owner });
        await this.voting.addVoter(accounts[3], { from: this.owner });

        await this.voting.startProposalsRegistering({ from: this.owner });
        await this.voting.addProposal("proposal1", { from: accounts[1] });
        await this.voting.addProposal("proposal2", { from: accounts[1] });
        await this.voting.addProposal("proposal3", { from: accounts[1] });

        await this.voting.endProposalsRegistering({ from: this.owner });
        await this.voting.startVotingSession({ from: this.owner });

        await this.voting.setVote(2, { from: accounts[1] })
        await this.voting.setVote(2, { from: accounts[2] })
        await this.voting.setVote(3, { from: accounts[3] })

        await this.voting.endVotingSession({ from: this.owner });

        const receipt = await this.voting.tallyVotes();
        const winningProposalID = await this.voting.winningProposalID.call();

        expect(winningProposalID).to.be.bignumber.equal(new BN(2));

        const winnerProposal = await this.voting.getOneProposal(2, { from: accounts[1] });
        expect(winnerProposal.description).to.be.equal("proposal2");
        expect(winnerProposal.voteCount).to.be.bignumber.equal(new BN(2));

        expectEvent(receipt, "WorkflowStatusChange", { previousStatus: new BN(4), newStatus: new BN(5) });
    });

    it("reverts if not at vote end session", async function () {
        let sessionFunctions = [this.voting.startProposalsRegistering, this.voting.endProposalsRegistering, this.voting.startVotingSession]
        for (let i = 0; i < sessionFunctions.length; i++) {
            await sessionFunctions[i]({ from: this.owner });
            await expectRevert(this.voting.tallyVotes({ from: this.owner }), "Current status is not voting session ended");
        }

        await this.voting.endVotingSession({ from: this.owner });
        await this.voting.tallyVotes({ from: this.owner });

        await expectRevert(this.voting.tallyVotes({ from: this.owner }), "Current status is not voting session ended");
    });
});
