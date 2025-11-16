// Example usage in your React app
import React from 'react'
import Globe from './Globe'
import './Globe.css'

function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Globe as background */}
      <Globe 
        transparent={true}
        oceanColor="#001122" 
        dotColor="#00ff88"
        autoRotate={true}
      />
      
      {/* Your app content overlayed on top */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 10,
        padding: '2rem',
        color: 'white'
      }}>
        <h1>Your App Title</h1>
        <p>This content appears over the interactive globe background</p>
        <button>Your App Buttons</button>
      </div>
    </div>
  )
}

export default App