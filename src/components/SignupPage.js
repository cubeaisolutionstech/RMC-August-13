"use client"

import React, { useState } from "react";

const SignupPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phoneNumber: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Email is invalid";
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required";
    else if (!/^\d{10}$/.test(formData.phoneNumber)) newErrors.phoneNumber = "Phone number must be 10 digits";
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
      const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, createdAt: new Date().toISOString() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert("Signup successful!");
        window.location.href = "/login"; // Redirect back to login page after success
      } else {
        setErrors({ general: data.error || "Signup failed" });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
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

  const renderFormGroup = (label, type, id, name, value, error, placeholder) => {
    return React.createElement(
      "div",
      { className: "form-group" },
      React.createElement("label", { htmlFor: id }, label),
      React.createElement("input", {
        type: type,
        id: id,
        name: name,
        value: value,
        onChange: handleChange,
        className: error ? "error" : "",
        placeholder: placeholder,
      }),
      error && React.createElement("span", { className: "error-message" }, error)
    );
  };

  const renderButtonGroup = () => {
    return React.createElement(
      "div",
      { className: "button-group", style: { display: "flex", gap: "16px" } },
      React.createElement(
        "button",
        {
          type: "submit",
          className: `login-button ${isLoading ? "loading" : ""}`,
          disabled: isLoading,
        },
        isLoading
          ? React.createElement("span", { className: "loading-spinner" })
          : "Save"
      )
    );
  };

  return React.createElement(
    "div",
    { className: "login-container" },
    React.createElement("div", { className: "login-background" }),
    React.createElement(
      "div",
      { className: "login-card" },
      React.createElement(
        "div",
        { className: "logo-container" },
        React.createElement(
          "div",
          { className: "company-logo" },
          React.createElement(
            "div",
            { className: "logo-icon" },
            React.createElement("svg", {
              width: "80",
              height: "80",
              viewBox: "0 0 80 80",
              fill: "none",
              xmlns: "http://www.w3.org/2000/svg",
              children: [
                React.createElement(
                  "defs",
                  null,
                  React.createElement(
                    "pattern",
                    {
                      id: "logoPattern",
                      patternUnits: "userSpaceOnUse",
                      width: "80",
                      height: "80",
                    },
                    React.createElement("image", {
                      href: "/logo.png",
                      x: "0",
                      y: "0",
                      width: "80",
                      height: "80",
                      preserveAspectRatio: "xMidYMid slice",
                    })
                  )
                ),
                React.createElement("circle", { cx: "40", cy: "40", r: "40", fill: "url(#logoPattern)" }),
              ],
            })
          ),
          React.createElement(
            "div",
            { className: "logo-text" },
            React.createElement("h1", null, "RR Builders"),
            React.createElement("p", null, "Construction Management System")
          )
        )
      ),
      React.createElement("h2", { className: "login-title" }, "Admin Signup"),
      React.createElement(
        "form",
        { onSubmit: handleSubmit, className: "login-form" },
        errors.general &&
          React.createElement("div", { className: "error-message general-error" }, errors.general),
        renderFormGroup(
          "Username",
          "text",
          "username",
          "username",
          formData.username,
          errors.username,
          "Enter your username"
        ),
        renderFormGroup(
          "Password",
          "password",
          "password",
          "password",
          formData.password,
          errors.password,
          "Enter your password"
        ),
        renderFormGroup(
          "Confirm Password",
          "password",
          "confirmPassword",
          "confirmPassword",
          formData.confirmPassword,
          errors.confirmPassword,
          "Confirm your password"
        ),
        renderFormGroup(
          "Email",
          "email",
          "email",
          "email",
          formData.email,
          errors.email,
          "Enter your email"
        ),
        renderFormGroup(
          "Phone Number",
          "tel",
          "phoneNumber",
          "phoneNumber",
          formData.phoneNumber,
          errors.phoneNumber,
          "Enter your phone number"
        ),
        renderButtonGroup()
      )
    )
  );
};

export default SignupPage;