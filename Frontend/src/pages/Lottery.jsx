import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import contractAddress from "../lib/ContractAddress";
import contractABI from "../lib/abi.json";
import { useAccount } from "wagmi";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

const Lottery = () => {
  const { id } = useParams();
  const [lottery, setLottery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);
  const [userName, setUserName] = useState("");
  const [buying, setBuying] = useState(false);
  const [userTicketCount, setUserTicketCount] = useState(0);
  const [winners, setWinners] = useState(null);
  const { address, isConnected } = useAccount();

  // Fetch lottery details and user tickets from blockchain
  const fetchLotteryData = async () => {
    if (!isConnected || !id) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        provider
      );

      const lotteryId = parseInt(id);
      const eventCounter = await contract.eventCounter();

      if (lotteryId >= Number(eventCounter) || lotteryId <= 0) {
        setLottery(null);
        setLoading(false);
        toast.error("Invalid lottery id");
        return;
      }
      // Fetch lottery info
      const lotteryInfo = await contract.getLotteryInfo(lotteryId);
      const tickets = await contract.getTickets(lotteryId);

      setLottery({
        id: Number(lotteryInfo.id),
        ticketPrice: lotteryInfo.ticketPrice.toString(),
        isClosed: lotteryInfo.isClosed,
        totalPool: lotteryInfo.totalPool.toString(),
        admin: lotteryInfo.admin,
        winner1: lotteryInfo.winner1,
        winner2: lotteryInfo.winner2,
        winner3: lotteryInfo.winner3,
        totalTickets: tickets.length,
      });

      //Initially calculate ticket cont directly from blockchain
      if (address) {
        const userTickets = tickets.filter(
          (ticketAddress) =>
            ticketAddress.toLowerCase() === address.toLowerCase()
        );
        setUserTicketCount(userTickets.length);
      }

      // If lottery is closed, fetch winners from WinnersDeclared event
      if (lotteryInfo.isClosed && lotteryInfo.winner1 !== ethers.ZeroAddress) {
        const filterWinners = contract.filters.WinnersDeclared(lotteryId);
        const winnersEvents = await contract.queryFilter(filterWinners);

        if (winnersEvents.length > 0) {
          const winnerEvent = winnersEvents[0];
          console.log(winnerEvent);
          
          // Event structure: winner1, winner1Name, winner2, winner2Name, winner3, winner3Name, totalPool
          setWinners({
            winner1: {
              address: winnerEvent.args[1],
              name: winnerEvent.args[2] || "Anonymous",
            },
            winner2: {
              address: winnerEvent.args[3],
              name: winnerEvent.args[4] || "Anonymous",
            },
            winner3: {
              address: winnerEvent.args[5],
              name: winnerEvent.args[6] || "Anonymous",
            },
          });
        }
      }
    } catch (err) {
      console.error("Error fetching lottery data:", err);
      toast.error("Failed to fetch lottery data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && id && address) {
      fetchLotteryData();
    }
  }, [isConnected, address, id]);

  // Buy tickets mutation
  const { mutate: buyTickets } = useMutation({
    mutationFn: async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      const lotteryId = parseInt(id);

      // Calculate total cost
      const ticketPriceBigInt = BigInt(lottery.ticketPrice);
      const totalCost = ticketPriceBigInt * BigInt(ticketCount);

      const tx = await contract.buyTickets(lotteryId, ticketCount, userName, {
        value: totalCost,
      });

      toast.success("Transaction sent. Waiting for confirmation...");
      const receipt = await tx.wait();
      return receipt;
    },
    onSuccess: async (receipt) => {
      toast.success("Tickets purchased successfully! 🎉");
      setBuying(false);

      // Find TicketBought event in the receipt and update user ticket count
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        provider
      );

      // Parse logs to find TicketBought event
      const ticketBoughtEvent = receipt.logs.find((log) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === "TicketBought";
        } catch {
          return false;
        }
      });
      
      if (ticketBoughtEvent) {
        const parsed = contract.interface.parseLog(ticketBoughtEvent);
        const purchasedCount = Number(parsed.args[2]); // tickets count
        const eventLotteryId = Number(parsed.args[0]); // lottery id
        const buyer = parsed.args[1]; // buyer address

        // Verify it's for this lottery and this user
        if (
          eventLotteryId === parseInt(id) &&
          buyer.toLowerCase() === address.toLowerCase()
        ) {
          setUserTicketCount((prev) => prev + purchasedCount);

          // Update total pool and tickets
          setLottery((prev) => ({
            ...prev,
            totalPool: (
              BigInt(prev.totalPool) +
              BigInt(lottery.ticketPrice) * BigInt(purchasedCount)
            ).toString(),
            totalTickets: prev.totalTickets + purchasedCount,
          }));
        }
      }

      setTicketCount(1);
    },
    onError: (error) => {
      console.error("buyTickets error:", error);
      if (error?.info?.error?.code === 4001) {
        toast.error("Transaction declined in MetaMask");
      }else {
        toast.error(error?.message || "Failed to buy tickets");
      }
      setBuying(false);
    },
  });

  const handleBuyTickets = () => {
    
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (ticketCount < 1) {
      toast.error("Please select at least 1 ticket");
      return;
    }

    if(!userName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setBuying(true);
    buyTickets();
  };

  const formatEthAmount = (weiAmount) => {
    try {
      return Number(ethers.formatEther(weiAmount)).toFixed(6);
    } catch {
      return "0";
    }
  };

  const calculateWinChance = () => {
    if (!lottery || lottery.totalTickets === 0) return 0;
    return ((userTicketCount / lottery.totalTickets) * 100).toFixed(2);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🎟️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to the Lottery!
          </h1>
          <p className="text-gray-600 text-lg">
            No sign in required, just connect your wallet to participate
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lottery...</p>
        </div>
      </div>
    );
  }

  // No lottery state
  if (!lottery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🎰</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Lottery Not Found
          </h1>
          <p className="text-gray-600 text-lg">
            This lottery does not exist or has been removed.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎟️ Lottery #{lottery.id}
              </h1>
              <p className="text-gray-600 mt-2">
                Your chance to win big prizes!
              </p>
            </div>
            <div className="flex justify-center items-center gap-2  p-2 rounded-lg ">
              <p className="text-sm text-gray-500 font-medium">Status:</p>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  lottery.isClosed
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green- 500"
                }`}
              >
                {lottery.isClosed ? "CLOSED" : "OPEN"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lottery Stats */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Lottery Information
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <p className="text-sm text-gray-600 font-medium mb-1">
                    Ticket Price
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatEthAmount(lottery?.ticketPrice)} ETH
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <p className="text-sm text-gray-600 font-medium mb-1">
                    Total Pool
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatEthAmount(lottery?.totalPool)} ETH
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <p className="text-sm text-gray-600 font-medium mb-1">
                    Tickets Sold
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {lottery?.totalTickets}
                  </p>
                </div>
              </div>
            </div>

            {/* Buy Tickets Form (only if lottery is open) */}
            {!lottery?.isClosed && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Buy Tickets
                </h2>
                <p className="text-gray-600 mb-6 italic">
                  The more tickets you buy, the higher your chances of winning!
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-2">
                      Number of Tickets
                    </label>
                    <input
                      type="number"
                      value={ticketCount}
                      onChange={(e) =>
                        setTicketCount(e.target.value)
                      }
                      className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">
                        Total Cost:{" "}
                        {formatEthAmount(
                          (
                            BigInt(lottery.ticketPrice) * BigInt(ticketCount)
                          ).toString()
                        )}{" "}
                        ETH
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleBuyTickets}
                    disabled={buying}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
                  >
                    {buying ? "Processing..." : "🎟️ Buy Tickets Now"}
                  </button>
                </div>
              </div>
            )}

            {/* Winners Section (only if closed) */}
            {lottery?.isClosed && winners && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  🏆 Winners Announced! 🏆
                </h2>
                <div className="space-y-4">
                  {/* 1st Place */}
                  <div className="p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border-2 border-green-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800 mb-1">
                          🥇 1st Place - 50% of Prize Pool
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {winners?.winner1?.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 font-mono">
                          {winners?.winner1?.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2nd Place */}
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-1">
                          🥈 2nd Place - 30% of Prize Pool
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {winners?.winner2?.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 font-mono">
                          {winners?.winner2?.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-800 mb-1">
                          🥉 3rd Place - 20% of Prize Pool
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {winners?.winner3?.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 font-mono">
                          {winners?.winner3?.address}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Tickets Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 ">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Your Participation
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Your Tickets</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {userTicketCount}
                  </p>
                </div>

                {lottery.totalTickets > 0 && userTicketCount > 0 && (
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Win Chance</p>
                    <p className="text-3xl font-bold text-green-600">
                      {calculateWinChance()}%
                    </p>
                  </div>
                )}

                {!lottery.isClosed && (
                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-gray-300">
                    <p className="text-sm font-bold text-blue-800 mb-2">
                       Pro Tip
                    </p>
                    <p className="text-xs text-gray-700">
                      Buy more tickets to increase your chances of winning! Each
                      ticket gives you another chance to win the jackpot.
                    </p>
                  </div>
                )}

                {!lottery.isClosed && (
                  <button
                    onClick={fetchLotteryData} //todo get this from events 
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg transition-colors font-medium"
                  >
                    🔄 Refresh Data
                  </button>
                )}
              </div>
            </div>

            {/* Prize Distribution */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Prize Distribution
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">🥇 1st Place</span>
                  <span className="font-bold text-green-600">50%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">🥈 2nd Place</span>
                  <span className="font-bold text-blue-600">30%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">🥉 3rd Place</span>
                  <span className="font-bold text-yellow-600">20%</span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Admin Fee</span>
                    <span className="text-gray-500">5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lottery;
