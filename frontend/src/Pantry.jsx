import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Pantry({ token, setShowLogin, handleLogout }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Active view
  const [activeView, setActiveView] = useState('dashboard')

  // Data stores (localStorage persisted)
  const [purchases, setPurchases] = useState(() => {
    const saved = localStorage.getItem('pantry_purchases')
    return saved ? JSON.parse(saved) : []
  })

  const [foodLogs, setFoodLogs] = useState(() => {
    const saved = localStorage.getItem('pantry_foodLogs')
    return saved ? JSON.parse(saved) : []
  })

  const [recipes, setRecipes] = useState(() => {
    const saved = localStorage.getItem('pantry_recipes')
    return saved ? JSON.parse(saved) : []
  })

  const [groceryList, setGroceryList] = useState(() => {
    const saved = localStorage.getItem('pantry_groceryList')
    return saved ? JSON.parse(saved) : []
  })

  // Form states
  const [foodLogText, setFoodLogText] = useState('')
  const [foodLogDate, setFoodLogDate] = useState(new Date().toISOString().split('T')[0])
  const [extractedFoodLog, setExtractedFoodLog] = useState(null)

  const [receiptImage, setReceiptImage] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [extractedReceipt, setExtractedReceipt] = useState(null)
  const [receiptStore, setReceiptStore] = useState('Walmart')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])

  const [newGroceryItem, setNewGroceryItem] = useState('')

  // Loading states
  const [isExtracting, setIsExtracting] = useState(false)

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('pantry_purchases', JSON.stringify(purchases))
  }, [purchases])

  useEffect(() => {
    localStorage.setItem('pantry_foodLogs', JSON.stringify(foodLogs))
  }, [foodLogs])

  useEffect(() => {
    localStorage.setItem('pantry_recipes', JSON.stringify(recipes))
  }, [recipes])

  useEffect(() => {
    localStorage.setItem('pantry_groceryList', JSON.stringify(groceryList))
  }, [groceryList])

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // ============ ANALYTICS ============

  // Get consumption patterns from food logs
  const getConsumptionPatterns = () => {
    const patterns = {}
    foodLogs.forEach(log => {
      log.items?.forEach(item => {
        const key = item.name.toLowerCase()
        if (!patterns[key]) {
          patterns[key] = { name: item.name, count: 0, lastConsumed: null, dates: [] }
        }
        patterns[key].count++
        patterns[key].dates.push(log.date)
        if (!patterns[key].lastConsumed || log.date > patterns[key].lastConsumed) {
          patterns[key].lastConsumed = log.date
        }
      })
    })
    return Object.values(patterns).sort((a, b) => b.count - a.count)
  }

  // Get purchase patterns
  const getPurchasePatterns = () => {
    const patterns = {}
    purchases.forEach(purchase => {
      purchase.items?.forEach(item => {
        const key = item.name.toLowerCase()
        if (!patterns[key]) {
          patterns[key] = { name: item.name, totalSpent: 0, count: 0, lastPurchased: null, avgPrice: 0 }
        }
        patterns[key].count++
        patterns[key].totalSpent += item.price || 0
        if (!patterns[key].lastPurchased || purchase.date > patterns[key].lastPurchased) {
          patterns[key].lastPurchased = purchase.date
        }
      })
    })
    Object.values(patterns).forEach(p => {
      p.avgPrice = p.count > 0 ? p.totalSpent / p.count : 0
    })
    return Object.values(patterns).sort((a, b) => b.count - a.count)
  }

  // Suggest grocery items based on patterns
  const getSuggestedGroceries = () => {
    const consumptionPatterns = getConsumptionPatterns()
    const purchasePatterns = getPurchasePatterns()
    const suggestions = []

    // Items consumed frequently but not purchased recently
    consumptionPatterns.slice(0, 10).forEach(item => {
      const purchased = purchasePatterns.find(p => p.name.toLowerCase() === item.name.toLowerCase())
      const daysSinceConsumed = item.lastConsumed
        ? Math.floor((Date.now() - new Date(item.lastConsumed)) / (1000 * 60 * 60 * 24))
        : 999
      const daysSincePurchased = purchased?.lastPurchased
        ? Math.floor((Date.now() - new Date(purchased.lastPurchased)) / (1000 * 60 * 60 * 24))
        : 999

      if (daysSincePurchased > 7 && item.count >= 2) {
        suggestions.push({
          name: item.name,
          reason: `Consumed ${item.count}x, last purchased ${daysSincePurchased}d ago`,
          priority: item.count
        })
      }
    })

    return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 5)
  }

  // ============ FOOD LOG FUNCTIONS ============

  const extractFoodLog = async () => {
    if (!foodLogText.trim()) return

    setIsExtracting(true)
    try {
      const response = await fetch(`${API_URL}/ai/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Extract food items from this daily food log. Return a JSON object with this structure:
{
  "meals": [
    { "type": "breakfast|lunch|dinner|snack", "items": ["item1", "item2"], "description": "original text" }
  ],
  "ingredients": ["ingredient1", "ingredient2"],
  "notes": "any relevant notes"
}

Food log: "${foodLogText}"`
        })
      })

      if (response.ok) {
        const data = await response.json()
        try {
          const parsed = JSON.parse(data.result.replace(/```json\n?|\n?```/g, ''))
          setExtractedFoodLog(parsed)
        } catch {
          // If JSON parse fails, create a simple structure
          setExtractedFoodLog({
            meals: [{ type: 'unspecified', items: [foodLogText], description: foodLogText }],
            ingredients: [],
            notes: 'Could not parse - saved as raw text'
          })
        }
      }
    } catch (err) {
      console.error('Extraction failed:', err)
      setExtractedFoodLog({
        meals: [{ type: 'unspecified', items: [foodLogText], description: foodLogText }],
        ingredients: [],
        notes: 'Extraction failed - saved as raw text'
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const saveFoodLog = () => {
    if (!extractedFoodLog) return

    const allItems = []
    extractedFoodLog.meals?.forEach(meal => {
      meal.items?.forEach(item => {
        allItems.push({ name: item, meal: meal.type })
      })
    })
    extractedFoodLog.ingredients?.forEach(ing => {
      if (!allItems.find(i => i.name.toLowerCase() === ing.toLowerCase())) {
        allItems.push({ name: ing, meal: 'ingredient' })
      }
    })

    const newLog = {
      id: crypto.randomUUID(),
      date: foodLogDate,
      rawText: foodLogText,
      meals: extractedFoodLog.meals,
      items: allItems,
      notes: extractedFoodLog.notes,
      createdAt: new Date().toISOString()
    }

    setFoodLogs([newLog, ...foodLogs])
    setFoodLogText('')
    setExtractedFoodLog(null)
  }

  // ============ RECEIPT FUNCTIONS ============

  const handleReceiptSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setReceiptImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const extractReceipt = async () => {
    if (!receiptImage) return

    setIsExtracting(true)
    try {
      const formData = new FormData()
      formData.append('image', receiptImage)
      formData.append('prompt', `Extract all line items from this receipt. Return a JSON object with this structure:
{
  "store": "store name if visible",
  "date": "date if visible (YYYY-MM-DD)",
  "items": [
    { "name": "product name", "brand": "brand if visible", "quantity": 1, "unit": "item/lb/oz", "price": 0.00, "category": "produce|dairy|meat|pantry|frozen|household|other" }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

Be thorough - capture every line item, including specific product variants, sizes, and whether items are organic/conventional.`)

      const response = await fetch(`${API_URL}/ai/extract-image`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        try {
          const parsed = JSON.parse(data.result.replace(/```json\n?|\n?```/g, ''))
          setExtractedReceipt(parsed)
          if (parsed.store) setReceiptStore(parsed.store)
          if (parsed.date) setReceiptDate(parsed.date)
        } catch {
          setExtractedReceipt({ items: [], notes: 'Could not parse receipt' })
        }
      }
    } catch (err) {
      console.error('Receipt extraction failed:', err)
      setExtractedReceipt({ items: [], notes: 'Extraction failed' })
    } finally {
      setIsExtracting(false)
    }
  }

  const saveReceipt = () => {
    if (!extractedReceipt) return

    const newPurchase = {
      id: crypto.randomUUID(),
      date: receiptDate,
      store: receiptStore,
      items: extractedReceipt.items || [],
      subtotal: extractedReceipt.subtotal,
      tax: extractedReceipt.tax,
      total: extractedReceipt.total,
      createdAt: new Date().toISOString()
    }

    setPurchases([newPurchase, ...purchases])
    setReceiptImage(null)
    setReceiptPreview(null)
    setExtractedReceipt(null)
  }

  // ============ GROCERY LIST FUNCTIONS ============

  const addGroceryItem = (e) => {
    e.preventDefault()
    if (!newGroceryItem.trim()) return

    setGroceryList([
      ...groceryList,
      { id: crypto.randomUUID(), name: newGroceryItem.trim(), checked: false, addedAt: new Date().toISOString() }
    ])
    setNewGroceryItem('')
  }

  const toggleGroceryItem = (id) => {
    setGroceryList(groceryList.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const removeGroceryItem = (id) => {
    setGroceryList(groceryList.filter(item => item.id !== id))
  }

  const addSuggestionToList = (name) => {
    if (!groceryList.find(item => item.name.toLowerCase() === name.toLowerCase())) {
      setGroceryList([
        ...groceryList,
        { id: crypto.randomUUID(), name, checked: false, addedAt: new Date().toISOString(), suggested: true }
      ])
    }
  }

  // ============ DELETE FUNCTIONS ============

  const deleteFoodLog = (id) => {
    setFoodLogs(foodLogs.filter(log => log.id !== id))
  }

  const deletePurchase = (id) => {
    setPurchases(purchases.filter(p => p.id !== id))
  }

  // ============ RENDER ============

  const suggestions = getSuggestedGroceries()
  const consumptionPatterns = getConsumptionPatterns()
  const purchasePatterns = getPurchasePatterns()

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        >
          ← Home
        </button>
        {token ? (
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            Login
          </button>
        )}
      </div>

      <h1 className="text-3xl md:text-4xl font-light font-serif text-center mb-2">
        Pantry
      </h1>
      <p className="text-neutral-500 text-sm text-center mb-6">
        Track what you eat, buy, and need
      </p>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'log', label: 'Food Log' },
          { id: 'scan', label: 'Scan Receipt' },
          { id: 'groceries', label: 'Grocery List' },
          { id: 'history', label: 'History' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeView === tab.id
                ? 'bg-teal-700 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ DASHBOARD VIEW ============ */}
      {activeView === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <p className="text-2xl font-semibold text-teal-600">{foodLogs.length}</p>
              <p className="text-xs text-neutral-500">Food Logs</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <p className="text-2xl font-semibold text-teal-600">{purchases.length}</p>
              <p className="text-xs text-neutral-500">Receipts</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <p className="text-2xl font-semibold text-teal-600">{consumptionPatterns.length}</p>
              <p className="text-xs text-neutral-500">Items Tracked</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <p className="text-2xl font-semibold text-teal-600">{groceryList.filter(i => !i.checked).length}</p>
              <p className="text-xs text-neutral-500">To Buy</p>
            </div>
          </div>

          {/* Suggested Groceries */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border border-teal-200 dark:border-teal-800/30">
            <h2 className="text-lg font-medium text-teal-800 dark:text-teal-300 mb-4">Suggested Groceries</h2>
            {suggestions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Log more food and scan receipts to get personalized suggestions
              </p>
            ) : (
              <div className="space-y-2">
                {suggestions.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/60 dark:bg-neutral-800/60 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-neutral-800 dark:text-neutral-100">{item.name}</p>
                      <p className="text-xs text-neutral-500">{item.reason}</p>
                    </div>
                    <button
                      onClick={() => addSuggestionToList(item.name)}
                      className="px-3 py-1 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setActiveView('log')}
              className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl text-left hover:scale-[1.02] transition-all"
            >
              <span className="text-2xl mb-2 block">📝</span>
              <p className="font-medium text-amber-800 dark:text-amber-300">Log Food</p>
              <p className="text-xs text-neutral-500 mt-1">What did you eat today?</p>
            </button>
            <button
              onClick={() => setActiveView('scan')}
              className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-2xl text-left hover:scale-[1.02] transition-all"
            >
              <span className="text-2xl mb-2 block">📷</span>
              <p className="font-medium text-blue-800 dark:text-blue-300">Scan Receipt</p>
              <p className="text-xs text-neutral-500 mt-1">Add a shopping trip</p>
            </button>
          </div>

          {/* Top Consumed Items */}
          {consumptionPatterns.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-medium mb-4">Most Consumed</h2>
              <div className="flex flex-wrap gap-2">
                {consumptionPatterns.slice(0, 12).map((item, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm"
                  >
                    {item.name} <span className="text-neutral-400">×{item.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ FOOD LOG VIEW ============ */}
      {activeView === 'log' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">Daily Food Log</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Describe what you ate today in natural language. AI will extract the details.
            </p>

            <div className="space-y-4">
              <input
                type="date"
                value={foodLogDate}
                onChange={(e) => setFoodLogDate(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <textarea
                value={foodLogText}
                onChange={(e) => setFoodLogText(e.target.value)}
                placeholder="e.g., Had eggs and toast for breakfast, grabbed Chipotle for lunch (burrito bowl with chicken, rice, beans, guac), made pasta with marinara for dinner..."
                className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[150px] text-sm"
              />

              <button
                onClick={extractFoodLog}
                disabled={!foodLogText.trim() || isExtracting}
                className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isExtracting ? 'Extracting...' : 'Extract & Preview'}
              </button>
            </div>

            {/* Extracted Preview */}
            {extractedFoodLog && (
              <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800/30">
                <h3 className="font-medium text-teal-800 dark:text-teal-300 mb-3">Extracted Data</h3>

                {extractedFoodLog.meals?.map((meal, i) => (
                  <div key={i} className="mb-3">
                    <p className="text-xs uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-1">
                      {meal.type}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {meal.items?.map((item, j) => (
                        <span key={j} className="px-2 py-1 bg-white dark:bg-neutral-800 rounded text-sm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {extractedFoodLog.ingredients?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-teal-200 dark:border-teal-800">
                    <p className="text-xs uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-1">
                      Ingredients Mentioned
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {extractedFoodLog.ingredients.map((ing, i) => (
                        <span key={i} className="px-2 py-1 bg-white dark:bg-neutral-800 rounded text-sm">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={saveFoodLog}
                  className="mt-4 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save Food Log
                </button>
              </div>
            )}
          </div>

          {/* Recent Food Logs */}
          {foodLogs.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-medium mb-4">Recent Logs</h2>
              <div className="space-y-3">
                {foodLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <button
                        onClick={() => deleteFoodLog(log.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">{log.rawText}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {log.items?.slice(0, 6).map((item, i) => (
                        <span key={i} className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-600 rounded text-xs">
                          {item.name}
                        </span>
                      ))}
                      {log.items?.length > 6 && (
                        <span className="px-2 py-0.5 text-xs text-neutral-500">+{log.items.length - 6} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SCAN RECEIPT VIEW ============ */}
      {activeView === 'scan' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">Scan Receipt</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Take a photo of your receipt. AI will extract all line items.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleReceiptSelect}
              className="hidden"
            />

            {!receiptPreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl hover:border-teal-500 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-4xl">📷</span>
                <span className="text-sm text-neutral-500">Tap to take photo or upload</span>
              </button>
            ) : (
              <div className="space-y-4">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full max-h-[300px] object-contain rounded-xl bg-neutral-100 dark:bg-neutral-900"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Store</label>
                    <input
                      type="text"
                      value={receiptStore}
                      onChange={(e) => setReceiptStore(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setReceiptImage(null); setReceiptPreview(null); setExtractedReceipt(null) }}
                    className="flex-1 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={extractReceipt}
                    disabled={isExtracting}
                    className="flex-1 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isExtracting ? 'Extracting...' : 'Extract Items'}
                  </button>
                </div>
              </div>
            )}

            {/* Extracted Receipt */}
            {extractedReceipt && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
                <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-3">
                  Extracted Items ({extractedReceipt.items?.length || 0})
                </h3>

                {extractedReceipt.items?.length > 0 ? (
                  <>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {extractedReceipt.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-white dark:bg-neutral-800 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-neutral-500">
                              {item.brand && `${item.brand} • `}
                              {item.quantity} {item.unit}
                              {item.category && ` • ${item.category}`}
                            </p>
                          </div>
                          <p className="font-medium text-neutral-600 dark:text-neutral-300">
                            ${item.price?.toFixed(2) || '—'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {extractedReceipt.total && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 flex justify-between font-medium">
                        <span>Total</span>
                        <span>${extractedReceipt.total.toFixed(2)}</span>
                      </div>
                    )}

                    <button
                      onClick={saveReceipt}
                      className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Save Receipt
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">No items extracted. Try a clearer photo.</p>
                )}
              </div>
            )}
          </div>

          {/* Recent Purchases */}
          {purchases.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-medium mb-4">Recent Purchases</h2>
              <div className="space-y-3">
                {purchases.slice(0, 5).map(purchase => (
                  <div key={purchase.id} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{purchase.store}</p>
                        <p className="text-xs text-neutral-500">
                          {new Date(purchase.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${purchase.total?.toFixed(2) || '—'}</p>
                        <button
                          onClick={() => deletePurchase(purchase.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-500">{purchase.items?.length || 0} items</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ GROCERY LIST VIEW ============ */}
      {activeView === 'groceries' && (
        <div className="space-y-6">
          {/* Add Item */}
          <form onSubmit={addGroceryItem} className="flex gap-2">
            <input
              type="text"
              value={newGroceryItem}
              onChange={(e) => setNewGroceryItem(e.target.value)}
              placeholder="Add item to list..."
              className="flex-1 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-xl transition-colors"
            >
              Add
            </button>
          </form>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800/30">
              <p className="text-xs uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-2">Suggested</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => addSuggestionToList(item.name)}
                    className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full text-sm hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grocery List */}
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {groceryList.length === 0 ? (
              <div className="p-12 text-center text-neutral-400">
                <p className="text-lg mb-2">Your list is empty</p>
                <p className="text-sm">Add items above or accept suggestions</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {groceryList.filter(i => !i.checked).map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => toggleGroceryItem(item.id)}
                      className="w-6 h-6 rounded-full border-2 border-neutral-300 dark:border-neutral-600 hover:border-teal-500 transition-all flex items-center justify-center"
                    />
                    <span className="flex-1">{item.name}</span>
                    {item.suggested && (
                      <span className="text-xs text-teal-600 dark:text-teal-400">suggested</span>
                    )}
                    <button
                      onClick={() => removeGroceryItem(item.id)}
                      className="text-neutral-400 hover:text-red-500 transition-all"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {groceryList.some(i => i.checked) && (
                  <>
                    <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-700/50">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Checked Off</p>
                    </div>
                    {groceryList.filter(i => i.checked).map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-4 opacity-50">
                        <button
                          onClick={() => toggleGroceryItem(item.id)}
                          className="w-6 h-6 rounded-full border-2 border-teal-500 bg-teal-500 flex items-center justify-center"
                        >
                          <span className="text-white text-xs">✓</span>
                        </button>
                        <span className="flex-1 line-through">{item.name}</span>
                        <button
                          onClick={() => removeGroceryItem(item.id)}
                          className="text-neutral-400 hover:text-red-500 transition-all"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {groceryList.some(i => i.checked) && (
            <button
              onClick={() => setGroceryList(groceryList.filter(i => !i.checked))}
              className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all"
            >
              Clear checked items
            </button>
          )}
        </div>
      )}

      {/* ============ HISTORY VIEW ============ */}
      {activeView === 'history' && (
        <div className="space-y-6">
          {/* Consumption Patterns */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">Consumption Patterns</h2>
            {consumptionPatterns.length === 0 ? (
              <p className="text-sm text-neutral-500">Log some food to see patterns</p>
            ) : (
              <div className="space-y-2">
                {consumptionPatterns.slice(0, 15).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                    <span>{item.name}</span>
                    <div className="text-right">
                      <span className="font-medium">{item.count}×</span>
                      <span className="text-xs text-neutral-500 ml-2">
                        last {item.lastConsumed ? new Date(item.lastConsumed).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchase Patterns */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">Purchase Patterns</h2>
            {purchasePatterns.length === 0 ? (
              <p className="text-sm text-neutral-500">Scan some receipts to see patterns</p>
            ) : (
              <div className="space-y-2">
                {purchasePatterns.slice(0, 15).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                    <span>{item.name}</span>
                    <div className="text-right">
                      <span className="font-medium">{item.count}×</span>
                      <span className="text-xs text-neutral-500 ml-2">
                        avg ${item.avgPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Food Logs */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">All Food Logs ({foodLogs.length})</h2>
            {foodLogs.length === 0 ? (
              <p className="text-sm text-neutral-500">No food logs yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {foodLogs.map(log => (
                  <div key={log.id} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">{new Date(log.date).toLocaleDateString()}</p>
                      <button
                        onClick={() => deleteFoodLog(log.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">{log.rawText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Purchases */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <h2 className="text-lg font-medium mb-4">All Purchases ({purchases.length})</h2>
            {purchases.length === 0 ? (
              <p className="text-sm text-neutral-500">No purchases yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {purchases.map(purchase => (
                  <div key={purchase.id} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{purchase.store}</p>
                        <p className="text-xs text-neutral-500">{new Date(purchase.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${purchase.total?.toFixed(2) || '—'}</p>
                        <button
                          onClick={() => deletePurchase(purchase.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {purchase.items?.slice(0, 8).map((item, i) => (
                        <span key={i} className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-600 rounded text-xs">
                          {item.name}
                        </span>
                      ))}
                      {purchase.items?.length > 8 && (
                        <span className="px-2 py-0.5 text-xs text-neutral-500">+{purchase.items.length - 8} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Pantry
