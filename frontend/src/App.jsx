import './App.css'
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './Home.jsx'
import ItemDetail from './itemDetail.jsx'
import Login from './Login.jsx'
import Landing from './Landing.jsx' 
import CommunityPage from './CommunityPage.jsx'
import Pantry from './Pantry.jsx' 

const API_URL = 'https://bradie-inventory-api.onrender.com'

function App() {
  const [list, setList] = useState([])
  const [communityList, setCommunityList] = useState([])
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole'))
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
      localStorage.setItem('userRole', data.role || 'admin')
      setToken(data.token)
      setUserRole(data.role || 'admin')
      setShowLogin(false)
      return true
    }
    return false
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    setToken(null)
    setUserRole(null)
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
        {/* Landing Page as the root - now with auth props */}
        <Route path="/" element={
          <Landing 
            list={list} 
            communityList={communityList} 
            token={token}
            setShowLogin={setShowLogin}
            handleLogout={handleLogout}
          />
        } />
        
        {/* Your personal inventory */}
        <Route path="/inventory" element={<Home
          list={list}
          setList={setList}
          token={token}
          userRole={userRole}
          setShowLogin={setShowLogin}
          handleLogout={handleLogout}
        />} />

        {/* Community Show & Tell */}
        <Route path="/community" element={<CommunityPage
          token={token}
          userRole={userRole}
          setShowLogin={setShowLogin}
          handleLogout={handleLogout}
        />} />

        {/* Pantry */}
        <Route path="/pantry" element={<Pantry
          token={token}
          setShowLogin={setShowLogin}
          handleLogout={handleLogout}
        />} />

        {/* Individual Item Details */}
        <Route path="/item/:id" element={<ItemDetail list={list} setList={setList} token={token} userRole={userRole} />} />
      </Routes>
    </div>
  )
}

export default App