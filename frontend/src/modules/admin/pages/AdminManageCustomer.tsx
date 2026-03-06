import { useState, useMemo, useEffect } from "react";
import {
  getAllCustomers,
  addWalletBalance,
  updateCustomer,
  type Customer,
} from "../../../services/api/admin/adminCustomerService";
import { useAuth } from "../../../context/AuthContext";

type SortField =
  | "id"
  | "name"
  | "email"
  | "phone"
  | "registrationDate"
  | "status"
  | "totalOrders"
  | "totalSpent";
type SortDirection = "asc" | "desc";

export default function AdminManageCustomer() {
  const { isAuthenticated, token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | undefined>(
    undefined
  );
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wallet Modal State
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedCustomerForWallet, setSelectedCustomerForWallet] = useState<Customer | null>(null);
  const [walletAmountToAdd, setWalletAmountToAdd] = useState<string>("");
  const [walletDescription, setWalletDescription] = useState<string>("");
  const [isAddingWallet, setIsAddingWallet] = useState(false);

  // View/Edit Modal State
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    status: "Active" | "Inactive";
  }>({
    name: "",
    email: "",
    phone: "",
    status: "Active"
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch customers on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: {
          page: number;
          limit: number;
          status?: "Active" | "Inactive";
          search?: string;
        } = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
        };

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getAllCustomers(params);
        if (response.success) {
          setCustomers(response.data);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
        if (err && typeof err === "object" && "response" in err) {
          const axiosError = err as {
            response?: { data?: { message?: string } };
          };
          setError(
            axiosError.response?.data?.message ||
            "Failed to load customers. Please try again."
          );
        } else {
          setError("Failed to load customers. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    statusFilter,
    searchQuery,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...customers];

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "id":
            aValue = a._id || "";
            bValue = b._id || "";
            break;
          case "name":
            aValue = a.name || "";
            bValue = b.name || "";
            break;
          case "email":
            aValue = a.email || "";
            bValue = b.email || "";
            break;
          case "phone":
            aValue = a.phone || "";
            bValue = b.phone || "";
            break;
          case "registrationDate":
            aValue = a.registrationDate || "";
            bValue = b.registrationDate || "";
            break;
          case "status":
            aValue = a.status || "";
            bValue = b.status || "";
            break;
          case "totalOrders":
            aValue = a.totalOrders || 0;
            bValue = b.totalOrders || 0;
            break;
          case "totalSpent":
            aValue = a.totalSpent || 0;
            bValue = b.totalSpent || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
        }
        if (typeof bValue === 'string') {
          bValue = bValue.toLowerCase();
        }

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    return filtered;
  }, [customers, sortField, sortDirection]);

  const totalPages = Math.ceil(
    filteredAndSortedCustomers.length / Number(entriesPerPage)
  );
  const startIndex = (currentPage - 1) * Number(entriesPerPage);
  const endIndex = startIndex + Number(entriesPerPage);
  const displayedCustomers = filteredAndSortedCustomers.slice(
    startIndex,
    endIndex
  );

  const handleExport = () => {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Registration Date",
      "Status",
      "Ref Code",
      "Wallet Amount",
      "Total Orders",
      "Total Spent",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedCustomers.map((customer) =>
        [
          customer._id.slice(-6),
          customer.name,
          customer.email,
          customer.phone,
          customer.registrationDate
            ? new Date(customer.registrationDate).toLocaleString()
            : "",
          customer.status,
          customer.refCode,
          customer.totalOrders,
          customer.totalSpent.toFixed(2),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `customers_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenWalletModal = (customer: Customer) => {
    setSelectedCustomerForWallet(customer);
    setWalletAmountToAdd("");
    setWalletDescription("");
    setShowWalletModal(true);
  };

  const handleAddWalletBalance = async () => {
    if (!selectedCustomerForWallet || !walletAmountToAdd) return;

    const amount = Number(walletAmountToAdd);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      setIsAddingWallet(true);
      const response = await addWalletBalance(
        selectedCustomerForWallet._id,
        amount,
        walletDescription || "Added by Admin"
      );

      if (response.success) {
        // Update local state
        setCustomers(prev => prev.map(c =>
          c._id === selectedCustomerForWallet._id
            ? { ...c, walletAmount: (c.walletAmount || 0) + amount }
            : c
        ));
        setShowWalletModal(false);
        // Could show toast here if toast context is available
        alert("Wallet balance updated successfully");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update wallet");
    } finally {
      setIsAddingWallet(false);
    }
  };

  const handleOpenViewModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status
    });
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      setIsUpdating(true);
      const response = await updateCustomer(selectedCustomer._id, editFormData);
      if (response.success) {
        setCustomers(prev => prev.map(c => c._id === selectedCustomer._id ? response.data : c));
        setShowEditModal(false);
        alert("Customer updated successfully");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update customer");
    } finally {
      setIsUpdating(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortField === field ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
              Manage Customer
            </h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-blue-600">Home</span> /{" "}
            <span className="text-neutral-900">Manage Customer</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          {/* Filters */}
          <div className="p-4 sm:p-6 border-b border-neutral-200 bg-neutral-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Date Range
                </label>
                <input
                  type="text"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  placeholder="MM/DD/YYYY - MM/DD/YYYY"
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter || "All"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatusFilter(val === "All" ? undefined : (val as "Active" | "Inactive"));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Show
                </label>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleExport}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  Export
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 sm:p-6 border-b border-neutral-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                Search:
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-3 py-2 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500"
                placeholder="Search by name, email, phone, or ref code..."
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("id")}>
                    <div className="flex items-center justify-between">
                      ID <SortIcon field="id" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("name")}>
                    <div className="flex items-center justify-between">
                      Name <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("email")}>
                    <div className="flex items-center justify-between">
                      Email <SortIcon field="email" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("phone")}>
                    <div className="flex items-center justify-between">
                      Phone <SortIcon field="phone" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("registrationDate")}>
                    <div className="flex items-center justify-between">
                      Registration Date <SortIcon field="registrationDate" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("status")}>
                    <div className="flex items-center justify-between">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200">Ref Code</th>
                  <th className="p-4 border border-neutral-200">Wallet</th>
                  {/* Total Orders column removed as requested */}
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("totalSpent")}>
                    <div className="flex items-center justify-between">
                      Total Spent <SortIcon field="totalSpent" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      Loading customers...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-red-600 border border-neutral-200">
                      {error}
                    </td>
                  </tr>
                ) : displayedCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  displayedCustomers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                      <td className="p-4 border border-neutral-200">
                        {customer._id.slice(-6)}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.name}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.email}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.phone}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.registrationDate
                          ? new Date(customer.registrationDate).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${customer.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                            }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.refCode}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        ₹{(customer.walletAmount || 0).toFixed(2)}
                      </td>
                      {/* Total Orders Removed 
                      <td className="p-4 border border-neutral-200">
                        {customer.totalOrders}
                      </td> */}
                      <td className="p-4 border border-neutral-200">
                        ₹{customer.totalSpent.toFixed(2)}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenViewModal(customer)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            title="View Details">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(customer)}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            title="Edit">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenWalletModal(customer)}
                            className="p-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors"
                            title="Add Wallet Balance">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredAndSortedCustomers.length)} of{" "}
              {filteredAndSortedCustomers.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-teal-600 rounded ${currentPage === 1
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                  : "text-teal-600 hover:bg-teal-50"
                  }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M15 18L9 12L15 6"></path>
                </svg>
              </button>
              <button className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm">
                {currentPage}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                  : "text-teal-600 hover:bg-teal-50"
                  }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M9 18L15 12L9 6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Modal */}
      {showWalletModal && selectedCustomerForWallet && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900">Add Wallet Balance</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-neutral-600 mb-2">
                  Adding balance for: <span className="font-bold">{selectedCustomerForWallet.name}</span>
                </p>
                <p className="text-sm text-neutral-600">
                  Current Balance: ₹{(selectedCustomerForWallet.walletAmount || 0).toFixed(2)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={walletAmountToAdd}
                  onChange={(e) => setWalletAmountToAdd(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  min="1"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={walletDescription}
                  onChange={(e) => setWalletDescription(e.target.value)}
                  placeholder="Reason for adding context"
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded hover:bg-neutral-200"
                  disabled={isAddingWallet}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWalletBalance}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:bg-teal-400"
                  disabled={isAddingWallet || !walletAmountToAdd}
                >
                  {isAddingWallet ? "Adding..." : "Add Balance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* View Modal */}
      {showViewModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
              <h3 className="font-bold text-lg text-neutral-900">Customer Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-neutral-500 hover:text-neutral-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Name</p>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCustomer.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {selectedCustomer.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Email</p>
                  <p className="font-medium break-all">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Phone</p>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Wallet Balance</p>
                  <p className="font-medium text-teal-600">₹{(selectedCustomer.walletAmount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Total Spent</p>
                  <p className="font-medium">₹{selectedCustomer.totalSpent.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Ref Code</p>
                  <p className="font-medium">{selectedCustomer.refCode}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Registered On</p>
                  <p className="font-medium">{new Date(selectedCustomer.registrationDate).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedCustomer.address && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <p className="font-semibold mb-2">Location</p>
                  <p className="text-sm text-neutral-600">
                    {selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 bg-neutral-200 text-neutral-800 rounded hover:bg-neutral-300 text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
              <h3 className="font-bold text-lg text-neutral-900">Edit Customer</h3>
              <button onClick={() => setShowEditModal(false)} className="text-neutral-500 hover:text-neutral-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as "Active" | "Inactive" })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 text-sm font-medium">Cancel</button>
              <button
                onClick={handleUpdateCustomer}
                disabled={isUpdating}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
