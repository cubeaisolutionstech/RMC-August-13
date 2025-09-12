"use client";

import { useState, useEffect } from "react";

const LoginPage = ({ onLogin, onSwitchToSignup }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Clear error messages after 5 seconds
  useEffect(() => {
    if (errors.general) {
      const timer = setTimeout(() => {
        setErrors((prev) => ({ ...prev, general: "" }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errors.general]);

  const validateForm = () => {
    const newErrors = {};
    if (!credentials.username.trim()) {
      newErrors.username = "Username is required";
    }
    if (!credentials.password.trim()) {
      newErrors.password = "Password is required";
    }
    if (!isLoginMode) {
      if (credentials.password !== credentials.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
      if (!credentials.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
        newErrors.email = "Invalid email format";
      }
      if (!credentials.phone.trim()) {
        newErrors.phone = "Phone number is required";
      } else if (!/^\+?[\d\s-]{8,15}$/.test(credentials.phone)) {
        newErrors.phone = "Invalid phone number format (8-15 digits, optional +)";
      }
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const endpoint = isLoginMode ? "http://localhost:5000/login" : "http://localhost:5000/signup";
      const payload = isLoginMode
        ? { username: credentials.username, password: credentials.password }
        : {
            username: credentials.username,
            password: credentials.password,
            email: credentials.email,
            phone: credentials.phone,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log("API Response:", data); // Debug log for response

      if (response.ok && data.success) {
        if (isLoginMode) {
          // Ensure all required fields are present, with fallbacks
          const userData = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email || "",
            phone_number: data.user.phone_number || "",
            role: data.user.role || "user",
            fullName: data.user.full_name || data.user.username,
            branchName: data.user.branch_name || "Main Branch",
            loginTime: new Date().toISOString(),
          };
          onLogin(userData); // Trigger navigation to Dashboard
          console.log("Login successful, navigating to Dashboard:", userData); // Debug log
        } else {
          setIsLoginMode(true);
          setErrors({ general: "Signup successful! Please log in." });
          setCredentials({
            username: "",
            password: "",
            confirmPassword: "",
            email: "",
            phone: "",
          });
        }
      } else {
        const errorMessage =
          data.error ||
          (isLoginMode ? "Invalid username or password" : "Signup failed. Please try again.");
        setErrors({ general: errorMessage });
        console.log("Login error:", errorMessage); // Debug log
      }
    } catch (error) {
      console.error(`${isLoginMode ? "Login" : "Signup"} error:`, error);
      setErrors({ general: "Network error. Please try again later." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setErrors({});
    setCredentials({
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      phone: "",
    });
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-card">
        <div className="logo-container">
          <div className="company-logo">
            <div className="logo-icon">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="logoPattern" patternUnits="userSpaceOnUse" width="80" height="80">
                    <image href="/logo.png" x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid slice" />
                  </pattern>
                </defs>
                <circle cx="40" cy="40" r="40" fill="url(#logoPattern)" />
              </svg>
            </div>
            <div className="logo-text">
              <h1>RR Builders</h1>
              <p>Construction Management System</p>
            </div>
          </div>
        </div>

        <h2 className="login-title">{isLoginMode ? "Admin Login" : "Admin Signup"}</h2>

        <form onSubmit={handleSubmit} className="login-form">
          {errors.general && <div className="error-message general-error">{errors.general}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              className={errors.username ? "error" : ""}
              placeholder="Enter your username"
            />
            {errors.username && <span className="error-message">{errors.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              className={errors.password ? "error" : ""}
              placeholder="Enter your password"
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {!isLoginMode && (
            <>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={credentials.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? "error" : ""}
                  placeholder="Confirm your password"
                />
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={credentials.email}
                  onChange={handleChange}
                  className={errors.email ? "error" : ""}
                  placeholder="Enter your email"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={credentials.phone}
                  onChange={handleChange}
                  className={errors.phone ? "error" : ""}
                  placeholder="Enter your phone number (e.g., +1234567890)"
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>
            </>
          )}

          <div className="button-group" style={{ display: "flex", gap: "16px" }}>
            <button
              type="submit"
              className={`login-button ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? <span className="loading-spinner"></span> : (isLoginMode ? "Login" : "Sign Up")}
            </button>
            <button
              type="button"
              className={`login-button ${isLoading ? "loading" : ""}`}
              onClick={toggleMode}
              disabled={isLoading}
            >
              {isLoginMode ? "Sign Up" : "Back to Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
