"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import EmployeeManagement from "./masters/EmployeeManagement";
import EmployeeLogin from "./masters/EmployeeLogin";
import BranchManagement from "./masters/BranchManagement";
import ProjectManagement from "./masters/ProjectManagement";
import RoleManagement from "./masters/RoleManagement";
import EmployeeProfile from "./masters/EmployeeProfile";
import VehicleEntry from "./inward/VehicleEntry";
import SupplierDetail from "./inward/SupplierDetail";
import PODetails from "./inward/PODetails";
import Intent from "./inward/Intent";
import GRN from "./inward/GRN";
import PurchaseOrder from "./inward/PurchaseOrder";
import Logs from "./Logs";
import SupplierPaymentDetails from "./inward/SupplierPaymentDetails";
import BatchSlipDetails from "./inward/BatchSlipDetails";
import CreateBatchSlip from "./inward/CreateBatchSlip";
import Invoices from "./inward/Invoices";
import InvoicePaymentDetails from "./inward/InvoicePaymentDetails";
import InventoryManagement from "./inward/InventoryManagement";

const Dashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    activeProjects: 0,
    vehicleEntries: 0,
    purchaseOrders: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeSection === "dashboard") {
      fetchDashboardStats();
    }
  }, [activeSection]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching dashboard stats...");

      const response = await fetch("http://localhost:5000/dashboard/stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Dashboard stats received:", data);

      // Normalize response keys to handle potential MongoDB naming differences
      setDashboardStats({
        totalEmployees: data.totalEmployees || data.total_employees || 0,
        activeProjects: data.activeProjects || data.active_projects || 0,
        vehicleEntries: data.vehicleEntries || data.vehicle_entries || 0,
        purchaseOrders: data.purchaseOrders || data.purchase_orders || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setError(error.message);

      // Try fallback method
      try {
        await fetchFallbackStats();
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFallbackStats = async () => {
    console.log("Trying fallback stats...");

    const endpoints = [
      {
        url: "http://localhost:5000/employees",
        key: "totalEmployees",
        filter: (data) => data.filter((item) => item.status === "Active" || item.isActive).length, // Handle MongoDB naming
      },
      {
        url: "http://localhost:5000/projects",
        key: "activeProjects",
        filter: (data) => data.filter((item) => item.status === "Active" || item.isActive).length,
      },
      {
        url: "http://localhost:5000/po",
        key: "purchaseOrders",
        filter: (data) => data.filter((item) => item.status === "Active" || item.isActive).length,
      },
    ];

    const stats = { ...dashboardStats };

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url);
        if (response.ok) {
          const data = await response.json();
          stats[endpoint.key] = endpoint.filter(data);
        }
      } catch (err) {
        console.error(`Failed to fetch ${endpoint.key}:`, err);
      }
    }

    // For vehicle entries, we'll set to 0 as fallback since we don't have vehicle data yet
    stats.vehicleEntries = 0;

    setDashboardStats(stats);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "add-employee":
        return <EmployeeManagement />;
      case "employee-login":
        return <EmployeeLogin />;
      case "branch":
        return <BranchManagement />;
      case "project":
        return <ProjectManagement />;
      case "role":
        return <RoleManagement />;
      case "employee-profile":
        return <EmployeeProfile />;
      case "vehicle-entry":
        return <VehicleEntry />;
      case "supplier-detail":
        return <SupplierDetail />;
      case "po-details":
        return <PODetails />;
      case "intent":
        return <Intent />;
      case "purchase-order":
        return <PurchaseOrder />;
      case "grn":
        return <GRN />;
      case "logs":
        return <Logs />;
      case "supplier-payment-details":
        return <SupplierPaymentDetails />;
      case "batch-slip-details":
        return <BatchSlipDetails />;
      case "create-batch-slip":
        return <CreateBatchSlip />;
      case "invoices":
        return <Invoices />;
      case "invoice-payment-details":
        return <InvoicePaymentDetails />;
      case "inventory-management":
        return <InventoryManagement />;
      default:
        return (
          <DashboardHome
            stats={dashboardStats}
            loading={loading}
            error={error}
            onRefresh={fetchDashboardStats}
            setActiveSection={setActiveSection}
          />
        );
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className={`main-content ${sidebarCollapsed ? "expanded" : ""}`}>
        <Header
          user={user}
          onLogout={onLogout}
          toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="content-area">{renderContent()}</div>
      </div>
    </div>
  );
};

const DashboardHome = ({ stats, loading, error, onRefresh, setActiveSection }) => {
  return (
    <div className="dashboard-home">
      <div className="welcome-section">
        <div className="welcome-header">
          <div className="welcome-logo">
            <svg
              width="80"
              height="80"
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="logoPattern"
                  patternUnits="userSpaceOnUse"
                  width="80"
                  height="80"
                >
                  <image
                    href="/logo.png"
                    x="0"
                    y="0"
                    width="80"
                    height="80"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </pattern>
              </defs>
              <circle cx="40" cy="40" r="40" fill="url(#logoPattern)" />
            </svg>
          </div>
          <div className="welcome-text">
            <h1>Welcome to RR Builders</h1>
            <p>
              Manage your construction projects, employees, and operations
              efficiently with our comprehensive platform.
            </p>
            <div className="dashboard-controls">
              <button
                onClick={onRefresh}
                className="refresh-btn"
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: loading ? "not-allowed" : "pointer",
                  marginTop: "10px",
                }}
              >
                {loading ? "Refreshing..." : "Refresh Stats"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>Total Employees</h3>
            <p className="stat-number">{loading ? "..." : stats.totalEmployees}</p>
            <span className="stat-change positive">Active employees</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏗️</div>
          <div className="stat-info">
            <h3>Active Projects</h3>
            <p className="stat-number">{loading ? "..." : stats.activeProjects}</p>
            <span className="stat-change positive">Ongoing projects</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚛</div>
          <div className="stat-info">
            <h3>Vehicle Entries</h3>
            <p className="stat-number">{loading ? "..." : stats.vehicleEntries}</p>
            <span className="stat-change neutral">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <h3>Purchase Orders</h3>
            <p className="stat-number">{loading ? "..." : stats.purchaseOrders}</p>
            <span className="stat-change positive">Active POs</span>
          </div>
        </div>
      </div>

      {/*
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-cards">
          <div
            className="action-card"
            onClick={() => setActiveSection("add-employee")}
          >
            <div className="action-icon">👤</div>
            <h4>Add User</h4>
            <p>Register new user</p>
          </div>
          <div
            className="action-card"
            onClick={() => setActiveSection("vehicle-entry")}
          >
            <div className="action-icon">🚛</div>
            <h4>Vehicle Entry</h4>
            <p>Record vehicle entry</p>
          </div>
          <div
            className="action-card"
            onClick={() => setActiveSection("po-details")}
          >
            <div className="action-icon">📋</div>
            <h4>Create PO</h4>
            <p>New purchase order</p>
          </div>
        </div>
      </div>
      */}
    </div>
  );
};

export default Dashboard;
