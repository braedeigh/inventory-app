import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Pantry({ token, setShowLogin, handleLogout }) {
  const navigate = useNavigate()

  // Pantry items state
  const [pantryItems, setPantryItems] = useState(() => {
    const saved = localStorage.getItem('pantryItems')
    return saved ? JSON.parse(saved) : []
  })

  // Grocery list state
  const [groceryList, setGroceryList] = useState(() => {
    const saved = localStorage.getItem('groceryList')
    return saved ? JSON.parse(saved) : []
  })

  // Form states
  const [newPantryItem, setNewPantryItem] = useState({ name: '', quantity: '', unit: '', expiresIn: '' })
  const [newGroceryItem, setNewGroceryItem] = useState('')

  // Tab state
  const [activeTab, setActiveTab] = useState('pantry')

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('pantryItems', JSON.stringify(pantryItems))
  }, [pantryItems])

  useEffect(() => {
    localStorage.setItem('groceryList', JSON.stringify(groceryList))
  }, [groceryList])

  // Calculate days until expiration
  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Get expiring soon items (within 7 days)
  const expiringSoon = pantryItems
    .filter(item => {
      const days = getDaysUntilExpiry(item.expiryDate)
      return days !== null && days <= 7 && days >= 0
    })
    .sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate))

  // Get expired items
  const expiredItems = pantryItems.filter(item => {
    const days = getDaysUntilExpiry(item.expiryDate)
    return days !== null && days < 0
  })

  // Get low stock items
  const lowStock = pantryItems.filter(item => item.quantity && parseInt(item.quantity) <= 2)

  // Add pantry item
  const addPantryItem = (e) => {
    e.preventDefault()
    if (!newPantryItem.name.trim()) return

    const expiryDate = newPantryItem.expiresIn
      ? new Date(Date.now() + parseInt(newPantryItem.expiresIn) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null

    setPantryItems([
      ...pantryItems,
      {
        id: crypto.randomUUID(),
        name: newPantryItem.name.trim(),
        quantity: newPantryItem.quantity || '1',
        unit: newPantryItem.unit || 'item(s)',
        expiryDate,
        addedAt: new Date().toISOString()
      }
    ])
    setNewPantryItem({ name: '', quantity: '', unit: '', expiresIn: '' })
  }

  // Add grocery item
  const addGroceryItem = (e) => {
    e.preventDefault()
    if (!newGroceryItem.trim()) return

    setGroceryList([
      ...groceryList,
      {
        id: crypto.randomUUID(),
        name: newGroceryItem.trim(),
        checked: false,
        addedAt: new Date().toISOString()
      }
    ])
    setNewGroceryItem('')
  }

  // Toggle grocery item
  const toggleGroceryItem = (id) => {
    setGroceryList(groceryList.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  // Delete grocery item
  const deleteGroceryItem = (id) => {
    setGroceryList(groceryList.filter(item => item.id !== id))
  }

  // Delete pantry item
  const deletePantryItem = (id) => {
    setPantryItems(pantryItems.filter(item => item.id !== id))
  }

  // Use pantry item (decrement quantity)
  const usePantryItem = (id) => {
    setPantryItems(pantryItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, parseInt(item.quantity) - 1)
        return { ...item, quantity: newQty.toString() }
      }
      return item
    }))
  }

  // Move grocery item to pantry
  const moveToPantry = (groceryItem) => {
    setPantryItems([
      ...pantryItems,
      {
        id: crypto.randomUUID(),
        name: groceryItem.name,
        quantity: '1',
        unit: 'item(s)',
        expiryDate: null,
        addedAt: new Date().toISOString()
      }
    ])
    deleteGroceryItem(groceryItem.id)
  }

  // Clear checked grocery items
  const clearCheckedGroceries = () => {
    setGroceryList(groceryList.filter(item => !item.checked))
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 pb-[50vh] md:pb-10 text-neutral-800 dark:text-neutral-100 max-w-4xl mx-auto">

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
        My Pantry
      </h1>
      <p className="text-neutral-500 text-sm text-center mb-8">
        Track your groceries and consumables
      </p>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Expiring Soon */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Expiring Soon</h3>
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing expiring</p>
          ) : (
            <ul className="space-y-1">
              {expiringSoon.slice(0, 3).map(item => (
                <li key={item.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                  {item.name} <span className="text-amber-600">({getDaysUntilExpiry(item.expiryDate)}d)</span>
                </li>
              ))}
              {expiringSoon.length > 3 && (
                <li className="text-xs text-amber-600">+{expiringSoon.length - 3} more</li>
              )}
            </ul>
          )}
        </div>

        {/* Expired */}
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
          <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Expired</h3>
          {expiredItems.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing expired</p>
          ) : (
            <ul className="space-y-1">
              {expiredItems.slice(0, 3).map(item => (
                <li key={item.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                  {item.name}
                </li>
              ))}
              {expiredItems.length > 3 && (
                <li className="text-xs text-red-600">+{expiredItems.length - 3} more</li>
              )}
            </ul>
          )}
        </div>

        {/* Low Stock */}
        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/30 rounded-xl">
          <h3 className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-2">Low Stock</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">All stocked up</p>
          ) : (
            <ul className="space-y-1">
              {lowStock.slice(0, 3).map(item => (
                <li key={item.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                  {item.name} <span className="text-teal-600">({item.quantity})</span>
                </li>
              ))}
              {lowStock.length > 3 && (
                <li className="text-xs text-teal-600">+{lowStock.length - 3} more</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'pantry'
              ? 'bg-teal-700 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Pantry ({pantryItems.length})
        </button>
        <button
          onClick={() => setActiveTab('grocery')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'grocery'
              ? 'bg-teal-700 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Grocery List ({groceryList.filter(i => !i.checked).length})
        </button>
      </div>

      {/* Pantry Tab */}
      {activeTab === 'pantry' && (
        <div>
          {/* Add Item Form */}
          <form onSubmit={addPantryItem} className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-6">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">Add to Pantry</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Item name"
                value={newPantryItem.name}
                onChange={(e) => setNewPantryItem({ ...newPantryItem, name: e.target.value })}
                className="col-span-2 md:col-span-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="number"
                placeholder="Qty"
                min="1"
                value={newPantryItem.quantity}
                onChange={(e) => setNewPantryItem({ ...newPantryItem, quantity: e.target.value })}
                className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <select
                value={newPantryItem.unit}
                onChange={(e) => setNewPantryItem({ ...newPantryItem, unit: e.target.value })}
                className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Unit</option>
                <option value="item(s)">item(s)</option>
                <option value="lb">lb</option>
                <option value="oz">oz</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="cup(s)">cup(s)</option>
                <option value="can(s)">can(s)</option>
                <option value="box(es)">box(es)</option>
                <option value="bag(s)">bag(s)</option>
              </select>
              <input
                type="number"
                placeholder="Expires in (days)"
                min="1"
                value={newPantryItem.expiresIn}
                onChange={(e) => setNewPantryItem({ ...newPantryItem, expiresIn: e.target.value })}
                className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              type="submit"
              className="mt-3 w-full py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add Item
            </button>
          </form>

          {/* Pantry Items */}
          {pantryItems.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-600">
              <p className="text-lg mb-2">Your pantry is empty</p>
              <p className="text-sm">Add items above to start tracking</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pantryItems.map(item => {
                const daysLeft = getDaysUntilExpiry(item.expiryDate)
                const isExpired = daysLeft !== null && daysLeft < 0
                const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0
                const isLow = parseInt(item.quantity) <= 2

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isExpired
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
                        : isExpiringSoon
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-neutral-800 dark:text-neutral-100">
                        {item.name}
                        {isExpired && <span className="ml-2 text-xs text-red-600 font-normal">EXPIRED</span>}
                        {isExpiringSoon && <span className="ml-2 text-xs text-amber-600 font-normal">{daysLeft}d left</span>}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {item.quantity} {item.unit}
                        {isLow && <span className="ml-2 text-teal-600">• Low stock</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => usePantryItem(item.id)}
                        className="px-3 py-1 text-sm bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-all"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => deletePantryItem(item.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Grocery Tab */}
      {activeTab === 'grocery' && (
        <div>
          {/* Add Item Form */}
          <form onSubmit={addGroceryItem} className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-6">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">Add to Grocery List</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="What do you need?"
                value={newGroceryItem}
                onChange={(e) => setNewGroceryItem(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </form>

          {/* Grocery Items */}
          {groceryList.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-600">
              <p className="text-lg mb-2">Your grocery list is empty</p>
              <p className="text-sm">Add items above to start your list</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {groceryList.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      item.checked
                        ? 'bg-neutral-100 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700/50'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleGroceryItem(item.id)}
                        className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-teal-600 focus:ring-teal-500"
                      />
                      <span className={`${item.checked ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-100'}`}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {item.checked && (
                        <button
                          onClick={() => moveToPantry(item)}
                          className="px-3 py-1 text-sm bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900/50 rounded-lg transition-all"
                        >
                          Add to Pantry
                        </button>
                      )}
                      <button
                        onClick={() => deleteGroceryItem(item.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {groceryList.some(item => item.checked) && (
                <button
                  onClick={clearCheckedGroceries}
                  className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all"
                >
                  Clear checked items
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Pantry
