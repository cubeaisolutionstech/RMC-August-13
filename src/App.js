"use client"

import { useState, useEffect } from "react"
import "./App.css"

import LoginPage from "./components/LoginPage"
import Dashboard from "./components/Dashboard"

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
  // TEMPORARY: Clear saved user on load for testing
  localStorage.removeItem("constructionAppUser")

  const savedUser = localStorage.getItem("constructionAppUser")
  console.log("Saved user:", savedUser)

  if (savedUser) {
    setUser(JSON.parse(savedUser))
    setIsLoggedIn(true)
  }
}, [])


  const handleLogin = (userData) => {
    setUser(userData)
    setIsLoggedIn(true)
    localStorage.setItem("constructionAppUser", JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    setIsLoggedIn(false)
    localStorage.removeItem("constructionAppUser")
  }

  return (
    <div className="app">
      {!isLoggedIn ? <LoginPage onLogin={handleLogin} /> : <Dashboard user={user} onLogout={handleLogout} />}
    </div>
  )
}

export default App
