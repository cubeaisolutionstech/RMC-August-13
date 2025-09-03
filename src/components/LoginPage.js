"use client"

import { useState } from "react"

const LoginPage = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = () => {
    const newErrors = {}
    if (!credentials.username.trim()) {
      newErrors.username = "Username is required"
    }
    if (!credentials.password.trim()) {
      
      newErrors.password = "Password is required"
    }
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateForm()

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const response = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        onLogin({
          username: data.user.username,
          role: data.user.role,
          fullName: data.user.full_name,
          branchName: data.user.branch_name,
          loginTime: new Date().toISOString(),
        })
      } else {
        setErrors({ general: data.error || "Invalid username or password" })
      }
    } catch (error) {
      console.error("Login error:", error)
      setErrors({ general: "Network error. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }
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

        <h2 className="login-title">Admin Login</h2>

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

          <button type="submit" className={`login-button ${isLoading ? "loading" : ""}`} disabled={isLoading}>
            {isLoading ? <span className="loading-spinner"></span> : "Login"}
          </button>
        </form>

       
      </div>

      
    </div>
  )
}

export default LoginPage
