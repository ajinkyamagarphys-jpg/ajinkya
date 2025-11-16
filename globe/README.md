# Interactive Globe Component

A beautiful 3D interactive globe with animated data flow rays, perfect for backgrounds in web applications.

## Features

- 🌍 **3D Globe**: Realistic Earth sphere with continent boundaries
- ✨ **Glowing Dots**: Pulsing firefly-like dots marking country boundaries  
- 🌐 **Data Flow Animation**: White parabolic rays flowing between major cities
- 🖱️ **Mouse Interaction**: Globe rotates following cursor movement
- 🔄 **Auto Rotation**: Smooth continuous rotation
- 📱 **Responsive**: Adapts to container size
- 🎨 **Transparent Background**: Perfect for overlaying on other content

## Installation

### Copy Files
Copy these files to your project:
- `Globe.jsx` - Main React component
- `Globe.css` - Styles
- `world-110m.json` - World map data (place in public folder)

### Install Dependencies
```bash
npm install three topojson-client
```

## Usage

### Basic Usage
```jsx
import Globe from './path/to/Globe'
import './path/to/Globe.css'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Globe />
    </div>
  )
}
```

### As Background
```jsx
function App() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Globe as background */}
      <Globe transparent={true} />
      
      {/* Your content on top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <h1>Your App Content</h1>
        <p>This content appears over the globe</p>
      </div>
    </div>
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | string | '100%' | Container width |
| `height` | string | '100vh' | Container height |
| `oceanColor` | string | '#001a1a' | Ocean sphere color |
| `dotColor` | string | '#00ff88' | Boundary dots color |
| `glowColor` | string | '#00ff88' | Glow effect color |
| `transparent` | boolean | true | Transparent background |
| `dotSize` | number | 2.0 | Size of boundary dots |
| `autoRotate` | boolean | true | Enable auto rotation |

## File Structure

```
your-project/
├── src/
│   └── components/
│       ├── Globe.jsx      # Main component
│       └── Globe.css      # Styles
└── public/
    └── world-110m.json    # World map data
```

## Customization

### Change Colors
```jsx
<Globe 
  oceanColor="#000033"    // Dark blue ocean
  dotColor="#ff6600"      // Orange dots
  glowColor="#ff6600"     // Orange glow
/>
```

### Disable Auto Rotation
```jsx
<Globe autoRotate={false} />
```

### Smaller Size
```jsx
<Globe 
  width="400px" 
  height="400px" 
  dotSize={1.5} 
/>
```

## Data Flow Routes

The component includes 20 predefined data flow routes between major cities:
- Delhi ↔ NYC
- Paris ↔ Tokyo  
- London ↔ Rio
- Sydney ↔ Dubai
- And 16 more global connections

## Performance

- Uses WebGL for smooth 3D rendering
- Includes fallback UI for browsers without WebGL support
- Optimized for 60fps animation
- Responsive to window resize

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Requires WebGL support

## License

MIT - Feel free to use in your projects!