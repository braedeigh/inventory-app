import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function Home({ list, setList, token }) { // Added token prop
  // State for form inputs
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [isNewPurchase, setIsNewPurchase] = useState(false)
  const [origin, setOrigin] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletedHistory, setDeletedHistory] = useState([])
  const navigate = useNavigate()


  const [editForm, setEditForm] = useState({
    itemName: '',
    description: '',
    category: '',
    isNewPurchase: false,
    origin: ''
  })

const handleAddItem = async () => {
    // Check if user is logged in before attempting POST operation
    if (!token) {
        console.error("User not logged in. Cannot add item.")
        return
    }

  const newItem = {
    id: crypto.randomUUID(),
    itemName,
    description,
    category,
    isNewPurchase,
    origin
  }

  const response = await fetch(`${API_URL}/`, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // ADDED: Authorization header
    },
    body: JSON.stringify(newItem)
  })

    if (response.ok) { // Only update state if API call succeeds
        setList([newItem, ...list])

        setItemName('')
        setDescription('')
        setCategory('other')
        setIsNewPurchase(false)
        setOrigin('')
    } else {
        console.error("Failed to add item.", await response.text())
        // Optionally handle 401 or other errors
    }
}
  
    
  const handleEdit = (index) => {
    const item = list[index]
    setEditForm({
        id: item.id,
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      isNewPurchase: item.isNewPurchase,
      origin: item.origin
    })
    setEditingIndex(index)
  }

const handleDelete = async (index) => {
    // Check if user is logged in before attempting DELETE operation
    if (!token) {
        console.error("User not logged in. Cannot delete item.")
        return
    }
  console.log('deleting item at index:', index)
  const itemToDelete = list[index]
  console.log('item to delete:', itemToDelete)
  
  const response = await fetch(`https://bradie-inventory-api.onrender.com/item/${itemToDelete.id}`, {
    method: 'DELETE',
    headers: {
        'Authorization': `Bearer ${token}` // ADDED: Authorization header
    }
  })

    if (response.ok) { // Only update state if API call succeeds
        const newHistory = [...deletedHistory, { item: itemToDelete, position: index }]
        console.log('new history:', newHistory)
        setDeletedHistory(newHistory)
        
        const updatedList = list.filter((item, i) => i !== index)
        setList(updatedList)
    } else {
        console.error("Failed to delete item.", await response.text())
    }
}

const handleUndo = async () => {
  if (deletedHistory.length === 0 || !token) return // Added token check

  const lastDeleted = deletedHistory[deletedHistory.length - 1]
  
  // Re-add to database
  const response = await fetch('https://bradie-inventory-api.onrender.com/', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // ADDED: Authorization header
    },
    body: JSON.stringify(lastDeleted.item)
  })

    if (response.ok) { // Only update state if API call succeeds
        const newList = [...list]
        newList.splice(lastDeleted.position, 0, lastDeleted.item)
        setList(newList)
        
        setDeletedHistory(deletedHistory.slice(0, -1))
    } else {
        console.error("Failed to undo delete.", await response.text())
    }
}

const handleSave = async () => {
    // Check if user is logged in before attempting PUT operation
    if (!token) {
        console.error("User not logged in. Cannot save item.")
        return
    }

  const response = await fetch(`https://bradie-inventory-api.onrender.com/item/${editForm.id}`, {
    method: 'PUT',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // ADDED: Authorization header
    },
    body: JSON.stringify(editForm)
  })

  if (response.ok) { // Only update state if API call succeeds
      const updatedItem = await response.json()

      const updatedList = list.map(item => 
          item.id === editForm.id ? updatedItem : item
      )
      setList(updatedList)
      setEditingIndex(null)
  } else {
      console.error("Failed to save item.", await response.text())
  }
}

  const handleCancel = () => {
    setEditingIndex(null)
  }

  
  return (
    <div>
      <h1>Bradie's Inventory</h1>
      
      {/* ADDED: Conditionally render the Add Item form only if logged in */}
      {token && ( 
        <form>
          <div>
            <label>Item Name:</label>
            <input 
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>

          <div>
            <label>Description:</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label>Category:</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="clothing">Clothing</option>
              <option value="jewelry">Jewelry</option>
              <option value="sentimental">Sentimental</option>
              <option value="bedding">Bedding</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label>
              <input 
                type="checkbox"
                checked={isNewPurchase}
                onChange={(e) => setIsNewPurchase(e.target.checked)}
              />
              Purchased after building this site
            </label>
          </div>

          <div>
            <label>Origin (optional):</label>
            <input 
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          <button type="button" onClick={handleAddItem}>Add Item</button>
        </form>
      )}

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>My Items</h2>
        {/* ADDED: Conditionally render Undo button only if logged in */}
        {deletedHistory.length > 0 && token && (
          <button onClick={handleUndo}>Undo Delete</button>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Item Name</th>
            <th>Description</th>
            <th>Category</th>
            <th>New Purchase</th>
            <th>Origin</th>
            {/* ADDED: Conditionally render Actions column header only if logged in */}
            {token && <th>Actions</th>} 
          </tr>
        </thead>
        <tbody>
          {list.map((item, index) => (
<tr 
  key={index} 
  onClick={() => {
    if (editingIndex !== index) {
      navigate(`/item/${item.id}`)
    }
  }} 
  style={{cursor: editingIndex === index ? 'default' : 'pointer'}}
>
<td onClick={(e) => e.stopPropagation()}>
  {item.mainPhoto ? (
    <img src={item.mainPhoto} alt={item.itemName} className="table-thumbnail" />
  ) : (
      <div className="table-thumbnail-empty">+</div>
  )}
</td>

              <td>
                {editingIndex === index ? (
                  <input 
                    value={editForm.itemName}
                    onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                  />
                ) : (
                  item.itemName
                )}
              </td>
              <td>
                {editingIndex === index ? (
                  <textarea 
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                ) : (
                    <span className="description-cell">{item.description}</span>
                )}
              </td>
            
              <td>
                {editingIndex === index ? (
                  <select 
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                  >
                    <option value="clothing">Clothing</option>
                    <option value="jewelry">Jewelry</option>
                    <option value="sentimental">Sentimental</option>
                    <option value="bedding">Bedding</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  item.category
                )}
              </td>
              <td>
                {editingIndex === index ? (
                  <input 
                    type="checkbox"
                    checked={editForm.isNewPurchase}
                    onChange={(e) => setEditForm({...editForm, isNewPurchase: e.target.checked})}
                  />
                ) : (
                    item.isNewPurchase ? 'Yes' : 'No'
                )}
              </td>
              <td>
                {editingIndex === index ? (
                  <input 
                    value={editForm.origin}
                    onChange={(e) => setEditForm({...editForm, origin: e.target.value})}
                  />
                ) : (
                  <span className="origin-cell">{item.origin}</span>
                )}
              </td>
              
              {/* ADDED: Conditionally render Actions cell only if logged in */}
              {token && (
                <td>
                  {editingIndex === index ? (
                    <>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        handleSave()
                      }}>Save</button>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        handleCancel()
                      }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(index)
                      }}>Edit</button>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(index)
                      }}>Delete</button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


export default Home