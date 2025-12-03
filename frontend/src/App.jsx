import './App.css'
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './Home.jsx'
import ItemDetail from './itemDetail.jsx'

function App() {
const [list, setList] = useState([])

useEffect(() => {
  fetch('https://bradie-inventory-api.onrender.com/')
    .then(res => res.json())
    .then(data => setList(data))
}, [])

  return (
    <Routes>
      <Route path="/" element={<Home list={list} setList={setList} />} />
      <Route path="/home" element={<Home list={list} setList={setList} />} />
      <Route path="/item/:id" element={<ItemDetail list={list} setList={setList} />} />
    </Routes>
  )
}


export default App