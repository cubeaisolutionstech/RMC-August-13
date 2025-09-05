"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const BatchSlipManagement = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState("create")
  const [batchSlips, setBatchSlips] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [generatedReport, setGeneratedReport] = useState(null)
  const [showReport, setShowReport] = useState(false)

  // Backend URL - update this to match your Flask server
  const API_BASE_URL = "http://localhost:5000"

  // Updated concrete mix formulas matching Bureau Veritas document exactly
  const concreteFormulas = {
    M20: {
      cement: 330,           // Cement content
      sand: 849.2,           // Manufactured sand  
      coarseAggregate20mm: 680.3,  // 20mm Coarse Aggregate
      coarseAggregate12mm: 453.6,  // 12.5mm Coarse Aggregate (showing as 12MM in report)
      admixture: 1.49,       // Admixture
      water: 165.0           // Free Water
    },
    M25: {
      cement: 350,
      sand: 846.3,
      coarseAggregate20mm: 678.0,
      coarseAggregate12mm: 452.0,
      admixture: 1.93,
      water: 161.0
    },
    M30: {
      cement: 380,
      sand: 836.4,
      coarseAggregate20mm: 670.1,
      coarseAggregate12mm: 446.7,
      admixture: 2.47,
      water: 159.6
    },
    M35: {
      cement: 410,
      sand: 800.7,
      coarseAggregate20mm: 668.3,
      coarseAggregate12mm: 445.5,
      admixture: 2.67,
      water: 164.0
    },
    M40: {
      cement: 440,
      sand: 790.9,
      coarseAggregate20mm: 660.0,
      coarseAggregate12mm: 440.0,
      admixture: 3.08,
      water: 162.8
    }
  }

  // Form state
  const [formData, setFormData] = useState({
    plantSerialNumber: "121-ML CR",
    batchDate: new Date().toISOString().split("T")[0],
    batchStartTime: "",
    batchEndTime: "",
    batchNumber: "",
    customer: "",
    site: "",
    recipeCode: "",
    recipeName: "",
    truckNumber: "",
    truckDriver: "",
    orderNumber: "",
    batcherName: "",
    orderedQuantity: "",
    productionQuantity: "",
    adjManualQuantity: "0.00",
    withThisLoad: "",
    mixerCapacity: "1.00",
    batchSize: "1.00",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientGSTIN: "",
    description: "",
    hsn: "6810",
    rate: "4000.00",
    quantity: "",
    unit: "M³",
  })

  const [errors, setErrors] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)

  const recipeOptions = [
    { code: "M20", name: "M20 Grade Concrete" },
    { code: "M25", name: "M25 Grade Concrete" },
    { code: "M30", name: "M30 Grade Concrete" },
    { code: "M35", name: "M35 Grade Concrete" },
    { code: "M40", name: "M40 Grade Concrete" },
  ]

  useEffect(() => {
    const saved = localStorage.getItem("batchSlipDetails")
    if (saved) {
      setBatchSlips(JSON.parse(saved))
    }
    
    if (!formData.batchNumber) {
      setFormData(prev => ({
        ...prev,
        batchNumber: generateBatchNumber(),
      }))
    }
  }, [])

  const generateBatchNumber = () => {
    const sequence = String(Math.floor(Math.random() * 9000) + 1000)
    return sequence
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      
      if (name === 'recipeCode') {
        const recipe = recipeOptions.find(r => r.code === value)
        updated.recipeName = recipe ? recipe.name : ''
        updated.description = recipe ? `Concrete ${value}` : ''
      }
      
      if (name === 'productionQuantity') {
        updated.withThisLoad = value
        updated.quantity = value
      }
      
      return updated
    })

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    const requiredFields = [
      "customer", "recipeCode", "recipeName", "truckNumber", 
      "truckDriver", "batcherName", "productionQuantity"
    ]

    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === "") {
        newErrors[field] = "This field is required"
      }
    })

    if (formData.productionQuantity && parseFloat(formData.productionQuantity) <= 0) {
      newErrors.productionQuantity = "Production quantity must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Calculate accurate batch values based on selected recipe and production quantity
  const calculateBatchValues = (recipeCode, productionQuantity, batchSize) => {
    const formula = concreteFormulas[recipeCode]
    if (!formula) return null

    const numBatches = Math.ceil(productionQuantity / batchSize)
    
    // Calculate target values per batch based on formula (kg per m³)
    const targetPerBatch = {
      sand: Math.round(formula.sand * batchSize),
      moisturePercent: 6, // 6% moisture content as per your requirement
      coarse6mm: 0, // Not used in current formulation
      coarse12mm: Math.round(formula.coarseAggregate12mm * batchSize),
      coarse20mm: Math.round(formula.coarseAggregate20mm * batchSize),
      cement: Math.round(formula.cement * batchSize),
      water: Math.round(formula.water * batchSize),
      msIce: 0, // Set to 0 as per your images
      admixture: parseFloat((formula.admixture * batchSize).toFixed(2))
    }

    // Calculate total set weights (targets for entire production)
    const totalSetWeights = {
      sand: Math.round(formula.sand * productionQuantity),
      moisturePercent: 6,
      coarse6mm: 0,
      coarse12mm: Math.round(formula.coarseAggregate12mm * productionQuantity),
      coarse20mm: Math.round(formula.coarseAggregate20mm * productionQuantity),
      cement: Math.round(formula.cement * productionQuantity),
      water: Math.round(formula.water * productionQuantity),
      msIce: 0,
      admixture: parseFloat((formula.admixture * productionQuantity).toFixed(2))
    }

    return {
      targetPerBatch,
      totalSetWeights,
      numBatches,
      formula
    }
  }

  const generateRandomVariation = (baseValue, materialType = 'default') => {
    let variationPercent = 2 // Default 2% variation
    
    switch (materialType) {
      case 'sand':
      case 'aggregate':
        variationPercent = 1.5 // Tighter control for aggregates
        break
      case 'cement':
        variationPercent = 1.0 // Very tight control for cement
        break
      case 'water':
        variationPercent = 3.0 // Slightly more variation for water
        break
      case 'admixture':
        variationPercent = 4.0 // More variation allowed for admixtures
        break
    }
    
    const variation = (Math.random() - 0.5) * 2 * (variationPercent / 100)
    const result = baseValue * (1 + variation)
    
    if (materialType === 'admixture') {
      return Math.max(0, parseFloat(result.toFixed(2)))
    }
    return Math.max(0, Math.round(result))
  }

  const generateBatchTimes = () => {
    const now = new Date()
    const endTime = now.toTimeString().slice(0, 5)
    const startTime = new Date(now.getTime() - (15 + Math.random() * 15) * 60000).toTimeString().slice(0, 5)
    
    return { startTime, endTime }
  }

  const generateBatchReport = () => {
    if (!validateForm()) return

    setIsGenerating(true)

    try {
      const productionQty = parseFloat(formData.productionQuantity)
      const batchSize = parseFloat(formData.batchSize)

      const batchCalculations = calculateBatchValues(formData.recipeCode, productionQty, batchSize)
      
      if (!batchCalculations) {
        throw new Error("Invalid recipe code selected")
      }

      const { targetPerBatch, totalSetWeights, numBatches, formula } = batchCalculations
      const { startTime, endTime } = generateBatchTimes()

      // Generate individual batch data with realistic variations
      const batchData = []
      let startingSeq = 430 + Math.floor(Math.random() * 50) // Random starting sequence number
      
      for (let i = 0; i < numBatches; i++) {
        const batchSeq = startingSeq + i
        batchData.push({
          seq: batchSeq,
          coarse12mm: generateRandomVariation(targetPerBatch.coarse12mm, 'aggregate'),
          sand: generateRandomVariation(targetPerBatch.sand, 'sand'),
          moisturePercent: "0.0", // As per your image format
          coarse6mm: 0,
          coarse20mm: generateRandomVariation(targetPerBatch.coarse20mm, 'aggregate'),
          cement: generateRandomVariation(targetPerBatch.cement, 'cement'),
          water: generateRandomVariation(targetPerBatch.water, 'water'),
          msIce: 0, // Set to 0 as per your images
          admixture: generateRandomVariation(targetPerBatch.admixture, 'admixture')
        })
      }

      // Calculate actual totals from generated batch data
      const actualTotals = {
        coarse12mm: batchData.reduce((sum, batch) => sum + batch.coarse12mm, 0),
        sand: batchData.reduce((sum, batch) => sum + batch.sand, 0),
        moisturePercent: "0.0",
        coarse6mm: 0,
        coarse20mm: batchData.reduce((sum, batch) => sum + batch.coarse20mm, 0),
        cement: batchData.reduce((sum, batch) => sum + batch.cement, 0),
        water: batchData.reduce((sum, batch) => sum + batch.water, 0),
        msIce: 0,
        admixture: parseFloat(batchData.reduce((sum, batch) => sum + batch.admixture, 0).toFixed(1))
      }

      const report = {
        ...formData,
        batchStartTime: startTime,
        batchEndTime: endTime,
        numBatches,
        formula,
        targetPerBatch,
        totalSetWeights,
        batchData,
        actualTotals,
        generatedAt: new Date().toISOString()
      }

      setGeneratedReport(report)
      setShowReport(true)

    } catch (error) {
      console.error("Error generating report:", error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveBatchSlip = async () => {
    if (generatedReport) {
      try {
        // Save to backend
        const response = await fetch(`${API_BASE_URL}/batch-slips`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(generatedReport)
        })

        if (response.ok) {
          // Also save locally
          const batchSlipData = {
            id: Date.now(),
            ...generatedReport,
            status: "Active",
            createdAt: new Date().toISOString()
          }

          const updated = [...batchSlips, batchSlipData]
          setBatchSlips(updated)
          localStorage.setItem("batchSlipDetails", JSON.stringify(updated))
          
          alert("Batch slip saved successfully!")
          setShowReport(false)
          resetForm()
        } else {
          throw new Error('Failed to save to backend')
        }
      } catch (error) {
        console.error('Error saving batch slip:', error)
        // Still save locally even if backend fails
        const batchSlipData = {
          id: Date.now(),
          ...generatedReport,
          status: "Active",
          createdAt: new Date().toISOString()
        }

        const updated = [...batchSlips, batchSlipData]
        setBatchSlips(updated)
        localStorage.setItem("batchSlipDetails", JSON.stringify(updated))
        
        alert("Batch slip saved locally (backend connection failed)")
        setShowReport(false)
        resetForm()
      }
    }
  }

  const resetForm = () => {
    setFormData({
      ...formData,
      batchNumber: generateBatchNumber(),
      customer: "",
      site: "",
      recipeCode: "",
      recipeName: "",
      truckNumber: "",
      truckDriver: "",
      orderNumber: "",
      batcherName: "",
      productionQuantity: "",
      withThisLoad: "",
      clientName: "",
      clientAddress: "",
      clientEmail: "",
      clientGSTIN: "",
      description: "",
      quantity: "",
    })
    setErrors({})
    setGeneratedReport(null)
    setShowReport(false)
  }

  const downloadPDF = () => {
    const printWindow = window.open('', '_blank')
    const reportHTML = generateReportHTML(generatedReport)
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Batch Slip - ${generatedReport.batchNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 5px 0; }
            th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; }
            th { background: #f0f0f0; font-weight: bold; }
            .header-table { border: 2px solid #000; margin-bottom: 10px; }
            .material-table { border: 2px solid #000; }
            @media print { 
              button { display: none; } 
              body { margin: 5px; }
            }
          </style>
        </head>
        <body>
          ${reportHTML}
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px;">Print PDF</button>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const generateReportHTML = (report) => {
    if (!report) return ""

    const targets = report.targetPerBatch
    const totals = report.totalSetWeights

    return `
      <div style="background: white; padding: 15px; font-family: Arial, sans-serif;">
        <!-- Header Section -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 10px;">
            <div style="width: 50px; height: 60px; background: #4CAF50; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 8px; border: 2px solid #333; flex-direction: column;">
              SCHWING<br>Stetter
            </div>
            <div>
              <h2 style="margin: 0; font-size: 16px; font-weight: bold;">THULASI READY MIX - ERODE</h2>
              <p style="margin: 2px 0; font-size: 12px;">MC1370 Control System Ver 1.0</p>
            </div>
          </div>
          <h3 style="margin: 10px 0; font-size: 14px; font-weight: bold;">Docket / Batch Report / Autographic Record</h3>
        </div>

        <!-- Batch Information Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px;">
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batch Date</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${new Date(report.batchDate).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Plant Serial Number</td>
            <td style="padding: 6px 10px; font-size: 14px;">${report.plantSerialNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batch Start Time</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.batchStartTime}</td>
            <td style="padding: 6px 10px;"></td>
            <td style="padding: 6px 10px;"></td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batch End Time</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.batchEndTime}</td>
            <td style="padding: 6px 10px;"></td>
            <td style="padding: 6px 10px;"></td>
          </tr>
          <tr><td colspan="4" style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batch Number / Docket Number:</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">${report.batchNumber}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Ordered Quantity</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.orderedQuantity || '0.00'} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Customer</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.customer}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Production Quantity</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.productionQuantity} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Site</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.site || 'N/A'}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Adj/Manual Quantity</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.adjManualQuantity} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Recipe Code</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.recipeCode}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">With This Load</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.withThisLoad} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Recipe Name</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.recipeName}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Mixer Capacity</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.mixerCapacity} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Truck Number</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.truckNumber}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batch Size</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.batchSize} M³</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Truck Driver</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.truckDriver}</td>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Net Wt From W.Bridge</td>
            <td style="padding: 6px 10px; font-size: 14px;">0.00 Kg</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Order Number</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.orderNumber || '0'}</td>
            <td style="padding: 6px 10px;"></td>
            <td style="padding: 6px 10px;"></td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; font-size: 14px;">Batcher Name</td>
            <td style="padding: 6px 10px; font-size: 14px;">: ${report.batcherName}</td>
            <td style="padding: 6px 10px;"></td>
            <td style="padding: 6px 10px;"></td>
          </tr>
        </table>

        <!-- Material Data Table -->
        <table style="width: 100%; border-collapse: collapse; border: 3px solid #000; font-size: 12px;">
          <thead>
            <tr style="background: #f0f0f0;">
              <th colspan="5" style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; font-size: 13px;">Aggregate</th>
              <th colspan="3" style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; font-size: 13px;">Cement</th>
              <th style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; font-size: 13px;">Water</th>
              <th style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; font-size: 13px;">MS / ICE</th>
              <th style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; font-size: 13px;">Admixture</th>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">12MM</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">M SAND</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">Moi</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">6MM</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">20 MM</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">CEM1</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">CEM2</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">CEM3</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">WATER</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">-</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 10px; font-weight: 600;">ADMIX1</td>
            </tr>
            <tr style="background: #f8f8f8;">
              <td style="border: 2px solid #000; padding: 6px; font-weight: bold; text-align: left; font-size: 12px;" colspan="11">Targets based on batchsize in Kgs.</td>
            </tr>
            <tr>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.coarse12mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.sand}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">In %</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.coarse20mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.cement}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.water}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: 500;">${targets.admixture}</td>
            </tr>
            <tr style="background: #f8f8f8;">
              <td style="border: 2px solid #000; padding: 6px; font-weight: bold; text-align: left; font-size: 12px;" colspan="11">Actual in Kgs.</td>
            </tr>
            ${report.batchData.map(batch => `
              <tr>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.coarse12mm}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.sand}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.moisturePercent}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.coarse6mm}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.coarse20mm}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">0</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.cement}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.water}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.msIce}</td>
                <td style="border: 2px solid #000; padding: 3px; text-align: center; font-size: 11px; font-weight: 500;">${batch.admixture}</td>
              </tr>
            `).join('')}
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td style="border: 2px solid #000; padding: 6px; text-align: left; font-size: 12px; font-weight: bold;" colspan="11">Total Set Weight in Kgs.</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.coarse12mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.sand}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.moisturePercent}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.coarse20mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.cement}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.water}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${totals.admixture}</td>
            </tr>
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td style="border: 2px solid #000; padding: 6px; text-align: left; font-size: 12px; font-weight: bold;" colspan="11">Total Actual in Kgs.</td>
            </tr>
            <tr style="font-weight: bold;">
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.coarse12mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.sand}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.moisturePercent}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.coarse20mm}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.cement}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.water}</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">0</td>
              <td style="border: 2px solid #000; padding: 4px; text-align: center; font-size: 11px; font-weight: bold;">${report.actualTotals.admixture}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this batch slip?")) {
      const updated = batchSlips.filter(slip => slip.id !== id)
      setBatchSlips(updated)
      localStorage.setItem("batchSlipDetails", JSON.stringify(updated))
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(batchSlips)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Slips")
    XLSX.writeFile(workbook, "batch_slips.xlsx")
  }

  const filteredBatchSlips = batchSlips.filter(slip =>
    (slip.batchNumber || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (slip.customer || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (slip.recipeCode || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  )

  if (showReport && generatedReport) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h2>Generated Batch Slip Report</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowReport(false)}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#6c757d', color: 'white', cursor: 'pointer' }}
            >
              ← Back to Form
            </button>
            <button 
              onClick={downloadPDF}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#17a2b8', color: 'white', cursor: 'pointer' }}
            >
              📄 Download PDF
            </button>
            <button 
              onClick={saveBatchSlip}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#28a745', color: 'white', cursor: 'pointer' }}
            >
              💾 Save Batch Slip
            </button>
          </div>
        </div>

        <div 
          style={{ border: '1px solid #ddd', padding: '30px', background: 'white', fontFamily: 'Arial, sans-serif' }}
          dangerouslySetInnerHTML={{ __html: generateReportHTML(generatedReport) }} 
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '32px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '15px', borderRadius: '12px', color: 'white' }}>📋</div>
          <h2 style={{ margin: 0, color: '#333', fontSize: '28px' }}>Batch Slip Management</h2>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {activeTab === "details" && (
            <>
              <input
                type="text"
                placeholder="Search batch slips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '10px 15px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px', minWidth: '250px' }}
              />
              <button 
                onClick={exportToExcel}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)', color: 'white', cursor: 'pointer' }}
              >
                📊 Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '0 20px' }}>
        <button 
          onClick={() => setActiveTab("create")}
          style={{ 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '16px', 
            cursor: 'pointer',
            background: activeTab === "create" ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e9ecef',
            color: activeTab === "create" ? 'white' : '#495057'
          }}
        >
          ➕ Create Batch Slip
        </button>
        <button 
          onClick={() => setActiveTab("details")}
          style={{ 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '16px', 
            cursor: 'pointer',
            background: activeTab === "details" ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e9ecef',
            color: activeTab === "details" ? 'white' : '#495057'
          }}
        >
          📋 View Batch Slips
        </button>
      </div>

      {activeTab === "create" && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
          <form onSubmit={(e) => { e.preventDefault(); generateBatchReport(); }}>
            <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #f1f3f4' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '24px', textAlign: 'center' }}>THULASI READY MIX - ERODE</h3>
              <p style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic', margin: '5px 0' }}>Batch Slip Creation Form</p>
            </div>

            <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #f1f3f4' }}>
              <h4 style={{ margin: '0 0 20px 0', color: '#495057', fontSize: '18px' }}>Batch Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Plant Serial Number</label>
                  <input
                    type="text"
                    name="plantSerialNumber"
                    value={formData.plantSerialNumber}
                    readOnly
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Batch Date</label>
                  <input
                    type="date"
                    name="batchDate"
                    value={formData.batchDate}
                    onChange={handleInputChange}
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Batch Number</label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleInputChange}
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Customer *</label>
                  <input
                    type="text"
                    name="customer"
                    value={formData.customer}
                    onChange={handleInputChange}
                    placeholder="TNUHDB-NKL"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.customer ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.customer && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.customer}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Site</label>
                  <input
                    type="text"
                    name="site"
                    value={formData.site}
                    onChange={handleInputChange}
                    placeholder="PALLIPALAYAM"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Recipe Code *</label>
                  <select
                    name="recipeCode"
                    value={formData.recipeCode}
                    onChange={handleInputChange}
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.recipeCode ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  >
                    <option value="">Select Recipe</option>
                    {recipeOptions.map(recipe => (
                      <option key={recipe.code} value={recipe.code}>
                        {recipe.code}
                      </option>
                    ))}
                  </select>
                  {errors.recipeCode && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.recipeCode}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Recipe Name *</label>
                  <input
                    type="text"
                    name="recipeName"
                    value={formData.recipeName}
                    onChange={handleInputChange}
                    placeholder="M25 Grade Concrete"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.recipeName ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.recipeName && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.recipeName}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Truck Number *</label>
                  <input
                    type="text"
                    name="truckNumber"
                    value={formData.truckNumber}
                    onChange={handleInputChange}
                    placeholder="TN 33 AU 4174"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.truckNumber ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.truckNumber && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.truckNumber}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Truck Driver *</label>
                  <input
                    type="text"
                    name="truckDriver"
                    value={formData.truckDriver}
                    onChange={handleInputChange}
                    placeholder="AUDAIYAPPAN"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.truckDriver ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.truckDriver && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.truckDriver}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Order Number</label>
                  <input
                    type="text"
                    name="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    placeholder="4"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Batcher Name *</label>
                  <input
                    type="text"
                    name="batcherName"
                    value={formData.batcherName}
                    onChange={handleInputChange}
                    placeholder="Stetter"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.batcherName ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.batcherName && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.batcherName}</span>}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #f1f3f4' }}>
              <h4 style={{ margin: '0 0 20px 0', color: '#495057', fontSize: '18px' }}>Production Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Ordered Quantity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="orderedQuantity"
                    value={formData.orderedQuantity}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Production Quantity (M³) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="productionQuantity"
                    value={formData.productionQuantity}
                    onChange={handleInputChange}
                    placeholder="6.50"
                    style={{ 
                      padding: '10px 12px', 
                      border: `2px solid ${errors.productionQuantity ? '#dc3545' : '#e9ecef'}`, 
                      borderRadius: '8px', 
                      fontSize: '14px' 
                    }}
                  />
                  {errors.productionQuantity && <span style={{ color: '#dc3545', fontSize: '12px' }}>{errors.productionQuantity}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Adj/Manual Quantity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="adjManualQuantity"
                    value={formData.adjManualQuantity}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>With This Load (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="withThisLoad"
                    value={formData.withThisLoad}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated"
                    readOnly
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px', backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Mixer Capacity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="mixerCapacity"
                    value={formData.mixerCapacity}
                    onChange={handleInputChange}
                    placeholder="1.00"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Batch Size (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="batchSize"
                    value={formData.batchSize}
                    onChange={handleInputChange}
                    placeholder="1.00"
                    style={{ padding: '10px 12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #f1f3f4' }}>
              <button 
                type="button" 
                onClick={resetForm} 
                disabled={isGenerating}
                style={{ 
                  padding: '12px 24px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontSize: '14px', 
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  background: '#6c757d', 
                  color: 'white',
                  opacity: isGenerating ? 0.6 : 1
                }}
              >
                Reset Form
              </button>
              <button 
                type="submit" 
                disabled={isGenerating}
                style={{ 
                  padding: '12px 24px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontSize: '14px', 
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', 
                  color: 'white',
                  opacity: isGenerating ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isGenerating ? (
                  <>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid #ffffff', 
                      borderRadius: '50%', 
                      borderTopColor: 'transparent', 
                      animation: 'spin 1s ease-in-out infinite' 
                    }}></span>
                    Generating...
                  </>
                ) : (
                  "Generate Batch Report"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "details" && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '20px' }}>Saved Batch Slip Records</h3>
              <div style={{ display: 'flex', gap: '15px' }}>
                <span style={{ padding: '8px 12px', background: 'white', borderRadius: '6px', fontSize: '14px', color: '#495057', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                  Total: <strong>{batchSlips.length}</strong>
                </span>
                <span style={{ padding: '8px 12px', background: 'white', borderRadius: '6px', fontSize: '14px', color: '#495057', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                  Showing: <strong>{filteredBatchSlips.length}</strong>
                </span>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>S.No</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Batch Number</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Batch Date</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Customer</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Recipe Code</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Production Qty (M³)</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Truck Number</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Status</th>
                  <th style={{ padding: '15px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatchSlips.map((slip, index) => (
                  <tr key={slip.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '15px 12px' }}>{index + 1}</td>
                    <td style={{ padding: '15px 12px', fontWeight: '600', color: '#495057' }}>{slip.batchNumber}</td>
                    <td style={{ padding: '15px 12px' }}>{new Date(slip.batchDate).toLocaleDateString()}</td>
                    <td style={{ padding: '15px 12px', fontWeight: '600', color: '#495057' }}>{slip.customer}</td>
                    <td style={{ padding: '15px 12px', fontWeight: '600', color: '#495057' }}>{slip.recipeCode}</td>
                    <td style={{ padding: '15px 12px', fontWeight: '500', color: '#495057' }}>{slip.productionQuantity}</td>
                    <td style={{ padding: '15px 12px', fontWeight: '600', color: '#495057' }}>{slip.truckNumber}</td>
                    <td style={{ padding: '15px 12px' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        background: '#d4edda', 
                        color: '#155724' 
                      }}>
                        {slip.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ 
                          padding: '6px 12px', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          background: '#17a2b8',
                          color: 'white'
                        }}>
                          View
                        </button>
                        <button style={{ 
                          padding: '6px 12px', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          background: '#28a745',
                          color: 'white'
                        }}>
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(slip.id)}
                          style={{ 
                            padding: '6px 12px', 
                            border: 'none', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: '600', 
                            cursor: 'pointer',
                            background: '#dc3545',
                            color: 'white'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredBatchSlips.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6c757d' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px', opacity: 0.5 }}>📋</div>
                <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '18px' }}>No Batch Slip Details Found</h4>
                <p style={{ color: '#6c757d', fontSize: '14px' }}>Create your first batch slip using the form above</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchSlipManagement
