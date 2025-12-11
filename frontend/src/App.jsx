import './App.css'
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './Home.jsx'
import ItemDetail from './itemDetail.jsx'
import Login from './Login.jsx'

const API_URL = 'https://bradie-inventory-api.onrender.com'

function App() {
  const [list, setList] = useState([])
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(res => res.json())
      .then(data => setList(data))
  }, [])

  const handleLogin = async (username, password) => {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await response.json()
    if (data.token) {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setShowLogin(false)
      return true
    }
    return false
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <div>
      <div className="auth-header">
        {token ? (
          <button onClick={handleLogout}>Logout</button>
        ) : (
          <button onClick={() => setShowLogin(true)}>Login</button>
        )}
      </div>
      
      {/* REMOVED: Blurb conditional block previously here */}

      {showLogin && (
        <Login 
          onLogin={handleLogin} 
          onClose={() => setShowLogin(false)} 
        />
      )}

      <Routes>
        <Route path="/" element={<Home list={list} setList={setList} token={token} />} />
        <Route path="/home" element={<Home list={list} setList={setList} token={token} />} />
        <Route path="/item/:id" element={<ItemDetail list={list} setList={setList} token={token} />} />
      </Routes>
    </div>
  )
}

export default App