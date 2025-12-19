import './App.css'
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './Home.jsx'
import ItemDetail from './itemDetail.jsx'
import Login from './Login.jsx'
import Landing from './Landing.jsx' 
import CommunityPage from './CommunityPage.jsx' 

const API_URL = 'https://bradie-inventory-api.onrender.com'

function App() {
  const [list, setList] = useState([])
  const [communityList, setCommunityList] = useState([]) // Moved inside function
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [showLogin, setShowLogin] = useState(false)

  // Fetch your personal inventory
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(res => res.json())
      .then(data => setList(data))
  }, [])

  // Fetch community items
  useEffect(() => {
    fetch(`${API_URL}/community`)
      .then(res => res.json())
      .then(data => setCommunityList(data))
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
      {showLogin && (
        <Login 
          onLogin={handleLogin} 
          onClose={() => setShowLogin(false)} 
        />
      )}

      <Routes>
        {/* Landing Page as the root */}
        <Route path="/" element={<Landing list={list} communityList={communityList} />} />
        
        {/* Your personal inventory */}
        <Route path="/inventory" element={<Home 
          list={list} 
          setList={setList} 
          token={token} 
          setShowLogin={setShowLogin} 
          handleLogout={handleLogout} 
        />} />

        {/* Community Show & Tell */}
        <Route path="/community" element={<CommunityPage 
          communityList={communityList} 
          setCommunityList={setCommunityList}
          token={token} 
        />} />

        {/* Individual Item Details */}
        <Route path="/item/:id" element={<ItemDetail list={list} setList={setList} token={token} />} />
      </Routes>
    </div>
  )
}

export default App