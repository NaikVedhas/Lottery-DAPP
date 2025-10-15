import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import contractAddress from "../lib/ContractAddress";
import contractABI from "../lib/abi.json";
import { useAccount } from "wagmi";
import { useMutation } from "@tanstack/react-query";

const Admin = () => {
  const [ticketPrice, setTicketPrice] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [lotteries, setLotteries] = useState([]);
  const [loadingLotteries, setLoadingLotteries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closingLotteryId, setClosingLotteryId] = useState(null);
  const { address, isConnected } = useAccount();

  // Check if connected user is the contract owner
  useEffect(() => {
    const checkOwner = async () => {
      if (!isConnected || !address) {
        setIsOwner(false);
        setCheckingOwner(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          provider
        );

        const ownerAddress = await contract.owner();
        setIsOwner(ownerAddress.toLowerCase() === address.toLowerCase());
      } catch (err) {
        console.error("Error checking owner:", err);
        setIsOwner(false);
      } finally {
        setCheckingOwner(false);
      }
    };

    checkOwner();
  }, [isConnected, address]);

  // Fetch all lotteries
  const fetchLotteries = async () => {
    if (!isConnected || !address) return;

    setLoadingLotteries(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        provider
      );

      const eventCounter = await contract.eventCounter();
      const lotteriesList = [];

      for (let i = 1; i < Number(eventCounter); i++) {
        const lotteryInfo = await contract.getLotteryInfo(i);
        const tickets = await contract.getTickets(i);
        lotteriesList.push({
          id: Number(lotteryInfo.id),
          ticketPrice: lotteryInfo.ticketPrice.toString(),
          isClosed: lotteryInfo.isClosed,
          totalPool: lotteryInfo.totalPool.toString(),
          admin: lotteryInfo.admin,
          winner1: lotteryInfo.winner1,
          winner2: lotteryInfo.winner2,
          winner3: lotteryInfo.winner3,
          tickets: tickets,
        });
      }

      //here if any lottery is closed then just fetch the event logs and get the winners data 

      setLotteries(lotteriesList.reverse());
    } catch (err) {
      console.error("Error fetching lotteries:", err);
      toast.error("Failed to fetch lotteries");
    } finally {
      setLoadingLotteries(false);
    }
  };
  console.log(lotteries);

  // Fetch lotteries on component mount
  useEffect(() => {
    if (isConnected && !checkingOwner && isOwner) {
      fetchLotteries();
    }
  }, [isConnected, checkingOwner, isOwner]);

  // Create lottery mutation
  const { mutate: createLottery } = useMutation({
    mutationFn: async () => {
      let ticketPriceInWei;
      try {
        // ticketPrice is entered in ETH (e.g., "0.05")
        // parseEther converts ETH → wei (BigInt)
        ticketPriceInWei = ethers.parseEther(ticketPrice);
      } catch (err) {
        console.error("Conversion error:", err);
        toast.error("Invalid ETH amount");
        throw err;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );
      // send value in wei directly (as BigInt)
      const tx = await contract.createLottery(ticketPriceInWei);
      toast.success("Transaction sent. Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log("createLottery receipt:", receipt);
      return receipt;
    },

    onSuccess: async () => {
      toast.success("Lottery created successfully!");
      setTicketPrice("");
      setSubmitting(false);
      await fetchLotteries();
    },
    onError: (error) => {
      console.error("createLottery error:", error);
      if (error.info.error.code === 4001) {
        toast.error("Transaction declined in Metamask");
      } else toast.error(error?.message || "Failed to create lottery");

      setSubmitting(false);
    },
  });

  // Close lottery mutation
  const { mutate: closeLottery } = useMutation({
    mutationFn: async (lotteryId) => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      const tx = await contract.closeAndDeclareWinners(lotteryId);
      toast.success("Transaction sent. Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log("closeAndDeclareWinners receipt:", receipt);
      return receipt;
    },
    onSuccess: async () => {
      toast.success("Lottery closed and winners declared!");
      setClosingLotteryId(null);
      await fetchLotteries();
    },
    onError: (error) => {
      console.error("closeAndDeclareWinners error:", error);
      toast.error(error?.message || "Failed to close lottery");
      setClosingLotteryId(null);
    },
  });

  const handleCreateLottery = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!ticketPrice || Number(ticketPrice) <= 0) {
      toast.error("Please enter a valid ticket price");
      setSubmitting(false);
      return;
    }

    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      setSubmitting(false);
      return;
    }

    createLottery();
  };

  const handleCloseLottery = (lotteryId) => {
    
    // Find the lottery object by ID
  const lottery = lotteries.find((l) => l.id === lotteryId);

  if (!lottery) {
    toast.error("Lottery not found");
    return;
  }

  // Check if there are at least 3 tickets sold
  if (lottery.tickets.length < 3) {
    toast.error("Not enough tickets sold to close the lottery");
    return;
  }
    
    
    toast(
      (t) => (
        <div className="p-1 flex flex-col gap-2 items-center">
          <p className="text-gray-800 text-sm text-center">
            Are you sure you want to close this lottery and declare winners?
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setClosingLotteryId(lotteryId);
                closeLottery(lotteryId);
                toast.dismiss(t.id);
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Yes, Close
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              No
            </button>
          </div>
        </div>
      ),
      {
        duration: Infinity, // stays until user chooses
      }
    );
  };

  // Format Wei to ETH
  const formatEthAmount = (weiAmount) => {
    try {
      return Number(ethers.formatEther(weiAmount)).toFixed(6);
    } catch {
      return "0";
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Please Connect Your Wallet
          </h1>
          <p className="text-gray-600 text-lg">
            Connect your wallet to access admin panel.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (checkingOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Not owner state
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-9xl font-bold text-red-500 mb-3">
            Access Denied
          </h1>
          <p className="text-gray-600 text-2xl">
            Only the contract owner can access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Vedhas</h1>
          <p className="text-gray-600 mt-1">
            Manage lotteries and create new ones
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Lottery Form */}
        <div className="mb-8 max-w-2xl">
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              Create New Lottery
            </h2>

            <form onSubmit={handleCreateLottery} className="space-y-5">
              {/* Ticket Price in ETH */}
              <div>
                <label className="block font-medium text-gray-700 mb-2">
                  Ticket Price (ETH)
                </label>
                <input
                  type="number"
                  step="0.000000001"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="e.g., 0.05"
                  min="0"
                />
                <div className="mt-2 text-sm text-gray-600">
                  Enter the ticket price in ETH
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                >
                  {submitting ? "Creating Lottery..." : "Create Lottery"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Lotteries List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-gray-50 px-6 py-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Lotteries</h2>
              <p className="text-gray-600 mt-1">
                {lotteries.length} lottery{lotteries.length !== 1 ? "ies" : ""}
              </p>
            </div>
            <button
              onClick={fetchLotteries}
              disabled={loadingLotteries}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {loadingLotteries ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingLotteries ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading lotteries...</p>
            </div>
          ) : lotteries?.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M14 10h-2m0 0h-2m2 0V8m0 2v2M8 6h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z"
                />
              </svg>
              <p className="text-gray-500 text-lg font-medium">
                No lotteries yet
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Create your first lottery to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {lotteries?.map((lottery) => (
                <div
                  key={lottery?.id}
                  className="px-6 py-5 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Lottery Info */}
                    <div>
                      <p className="text-sm text-gray-500 font-medium">
                        Lottery ID
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        #{lottery?.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 font-medium">
                        Ticket Price
                      </p>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatEthAmount(lottery?.ticketPrice)} ETH
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 font-medium">
                        Total Pool
                      </p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatEthAmount(lottery?.totalPool)} ETH
                      </p>
                    </div>

                    {/* 🎟️ Tickets Sold */}
                    <div>
                      <p className="text-sm text-gray-500 font-medium">
                        Tickets Sold
                      </p>
                      <p className="text-lg font-semibold text-purple-600">
                        {lottery?.tickets?.length ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          lottery.isClosed
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {lottery?.isClosed ? "Closed" : "Active"}
                      </span>
                    </div>
                  </div>

                  {/* Winners Section (if closed) */}
                  {lottery?.isClosed &&
                    lottery?.winner1 !== ethers.ZeroAddress && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Winners
                        </p>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">1st Prize:</span>{" "}
                            {lottery?.winner1.substring(0, 10)}...
                          </p>
                          <p className="text-gray-600">
                            <span className="font-medium">2nd Prize:</span>{" "}
                            {lottery?.winner2.substring(0, 10)}...
                          </p>
                          <p className="text-gray-600">
                            <span className="font-medium">3rd Prize:</span>{" "}
                            {lottery?.winner3.substring(0, 10)}...
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Action Button */}
                  {!lottery.isClosed && (
                    <button
                      onClick={() => handleCloseLottery(lottery?.id)}
                      disabled={closingLotteryId === lottery?.id}
                      className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                    >
                      {closingLotteryId === lottery.id
                        ? "Closing & Declaring Winners..."
                        : "Close & Declare Winners"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
