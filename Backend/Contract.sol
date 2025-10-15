// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LotteryDapp {
    struct Lottery {
        uint256 id;
        uint256 ticketPrice;
        bool isClosed;
        uint256 totalPool;
        address admin;
        address winner1;
        address winner2;
        address winner3;
    }

    address public owner;
    uint256 public eventCounter = 1;

    mapping(uint256 => Lottery) public lotteries;
    mapping(uint256 => address[]) public lotteryTickets;
    mapping(address => string) public userNames; // single name per address

    uint256 public adminFeePercent = 5;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyLotteryAdmin(uint256 lotteryId) {
        require(lotteries[lotteryId].admin == msg.sender, "Not lottery admin");
        _;
    }

    // ---------------- Events ----------------
    event LotteryCreated(uint256 indexed lotteryId, uint256 ticketPrice, address admin);
    event TicketBought(uint256 indexed lotteryId, address indexed buyer, uint256 tickets);
    event WinnersDeclared(
        uint256 indexed lotteryId,
        address winner1,
        string winner1Name,
        address winner2,
        string winner2Name,
        address winner3,
        string winner3Name,
        uint256 totalPool
    );

    // ---------------- Constructor ----------------
    constructor() {
        owner = msg.sender;
    }

    // ---------------- Lottery Management ----------------
    function createLottery(uint256 ticketPrice) external onlyOwner {
        require(ticketPrice > 0, "Ticket price must be > 0");

        Lottery storage newLottery = lotteries[eventCounter];
        newLottery.id = eventCounter;
        newLottery.ticketPrice = ticketPrice;
        newLottery.isClosed = false;
        newLottery.totalPool = 0;
        newLottery.admin = msg.sender;

        emit LotteryCreated(eventCounter, ticketPrice, msg.sender);
        eventCounter++;
    }

    // ---------------- Ticket Purchase ----------------
    function buyTickets(uint256 lotteryId, uint256 count, string calldata name) external payable {
        Lottery storage l = lotteries[lotteryId];
        require(!l.isClosed, "Lottery is closed");
        require(count > 0, "Must buy at least 1 ticket");
        require(msg.value == count * l.ticketPrice, "Incorrect ETH sent");

        // Store user name (overwrite if already exists)
        userNames[msg.sender] = name;

        // Add to flattened tickets array
        for (uint256 i = 0; i < count; i++) {
            lotteryTickets[lotteryId].push(msg.sender);
        }

        l.totalPool += msg.value;

        emit TicketBought(lotteryId, msg.sender, count);
    }

    // ---------------- Close & Declare Winners ----------------
    function closeAndDeclareWinners(uint256 lotteryId) external onlyLotteryAdmin(lotteryId) {
        Lottery storage l = lotteries[lotteryId];
        require(!l.isClosed, "Lottery already closed");

        l.isClosed = true;

        address[] storage ticketsArray = lotteryTickets[lotteryId];
        require(ticketsArray.length >= 3, "Not enough tickets sold");

        // Random winner indices
        uint256 rand1 = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, ticketsArray.length))) % ticketsArray.length;
        uint256 rand2 = uint256(keccak256(abi.encodePacked(rand1, block.timestamp))) % ticketsArray.length;
        uint256 rand3 = uint256(keccak256(abi.encodePacked(rand2, block.prevrandao))) % ticketsArray.length;

        // Pick winners
        address winner1 = ticketsArray[rand1];
        address winner2 = ticketsArray[rand2];
        address winner3 = ticketsArray[rand3];

        // Ensure distinct winners
        if (winner2 == winner1) {
            winner2 = ticketsArray[(rand2 + 1) % ticketsArray.length];
        }
        if (winner3 == winner1 || winner3 == winner2) {
            winner3 = ticketsArray[(rand3 + 2) % ticketsArray.length];
        }

        l.winner1 = winner1;
        l.winner2 = winner2;
        l.winner3 = winner3;

        // Payout calculation
        uint256 adminFee = (l.totalPool * adminFeePercent) / 100;
        uint256 prizePool = l.totalPool - adminFee;

        uint256 firstPrize = (prizePool * 50) / 100;
        uint256 secondPrize = (prizePool * 30) / 100;
        uint256 thirdPrize = prizePool - firstPrize - secondPrize;

        // Transfer funds
        payable(owner).transfer(adminFee);
        payable(winner1).transfer(firstPrize);
        payable(winner2).transfer(secondPrize);
        payable(winner3).transfer(thirdPrize);

        // Emit winners with names for frontend
        emit WinnersDeclared(
            lotteryId,
            winner1,
            userNames[winner1],
            winner2,
            userNames[winner2],
            winner3,
            userNames[winner3],
            l.totalPool
        );
    }

    // ---------------- View Functions ----------------
    function getTickets(uint256 lotteryId) external view returns (address[] memory) {
        return lotteryTickets[lotteryId];
    }

    function getLotteryInfo(uint256 lotteryId) external view returns (
        uint256 id,
        uint256 ticketPrice,
        bool isClosed,
        uint256 totalPool,
        address admin,
        address winner1,
        address winner2,
        address winner3
    ) {
        Lottery storage l = lotteries[lotteryId];
        return (l.id, l.ticketPrice, l.isClosed, l.totalPool, l.admin, l.winner1, l.winner2, l.winner3);
    }
}
