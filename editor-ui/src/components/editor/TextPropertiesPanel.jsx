// src/components/editor/TextPropertiesPanel.jsx - ENHANCED WITH GLASSMORPHISM
import { useState, useEffect } from "react"
import { useEditorStore } from "../../store/editorStore"

export default function TextPropertiesPanel() {
  const timeline = useEditorStore((s) => s.timeline)
  const updateClip = useEditorStore((s) => s.updateClip)
  const selectedClipId = timeline.selectedClipId
  
  const selectedTextClip = timeline.tracks
    .flatMap(track => track.clips)
    .find(clip => clip.clip_id === selectedClipId && clip.type === 'text')

  const [localStyle, setLocalStyle] = useState(null)

  useEffect(() => {
    if (selectedTextClip) {
      setLocalStyle(selectedTextClip.textStyle || {
        fontSize: 48,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#FFFFFF',
        backgroundColor: 'transparent',
        textAlign: 'center'
      })
    }
  }, [selectedTextClip])

  if (!selectedTextClip || !localStyle) return null

  const updateStyle = (updates) => {
    const newStyle = { ...localStyle, ...updates }
    setLocalStyle(newStyle)
    updateClip(selectedClipId, { textStyle: newStyle })
  }

  const fontPresets = [
    { name: 'Heading', size: 64, weight: 'bold' },
    { name: 'Title', size: 48, weight: '600' },
    { name: 'Body', size: 32, weight: 'normal' },
    { name: 'Caption', size: 24, weight: 'normal' }
  ]

  const colorPresets = [
    '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', 
    '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'
  ]

  return (
    <div 
      className="text-properties-panel"
      style={{
        position: 'fixed',
        right: '20px',
        top: '100px',
        width: '320px',
        maxHeight: 'calc(100vh - 400px)',
        background: 'rgba(20, 28, 55, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: '16px',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(34, 211, 238, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
        padding: '20px',
        zIndex: 500,
        overflow: 'auto',
        border: '1px solid rgba(34, 211, 238, 0.15)'
      }}
    >
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid rgba(34, 211, 238, 0.2)'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#22d3ee', 
          fontSize: '16px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textShadow: '0 2px 8px rgba(34, 211, 238, 0.3)'
        }}>
          <span style={{ fontSize: '20px' }}>✏️</span> Text Properties
        </h3>
      </div>

      {/* Font Size Presets */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block', 
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Quick Styles
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {fontPresets.map(preset => (
            <button
              key={preset.name}
              onClick={() => updateStyle({ fontSize: preset.size, fontWeight: preset.weight })}
              style={{
                padding: '10px',
                background: localStyle.fontSize === preset.size && localStyle.fontWeight === preset.weight
                  ? 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s',
                boxShadow: localStyle.fontSize === preset.size && localStyle.fontWeight === preset.weight
                  ? '0 4px 12px rgba(34, 211, 238, 0.3)'
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (!(localStyle.fontSize === preset.size && localStyle.fontWeight === preset.weight)) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!(localStyle.fontSize === preset.size && localStyle.fontWeight === preset.weight)) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Slider */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <span>Font Size</span>
          <span style={{ color: '#22d3ee', fontWeight: '700' }}>{localStyle.fontSize}px</span>
        </label>
        <input
          type="range"
          min="16"
          max="120"
          value={localStyle.fontSize}
          onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: `linear-gradient(90deg, 
              rgba(34, 211, 238, 0.4) 0%, 
              rgba(34, 211, 238, 0.4) ${((localStyle.fontSize - 16) / (120 - 16)) * 100}%,
              rgba(255, 255, 255, 0.1) ${((localStyle.fontSize - 16) / (120 - 16)) * 100}%,
              rgba(255, 255, 255, 0.1) 100%
            )`,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none'
          }}
        />
      </div>

      {/* Font Family */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Font Family
        </label>
        <select
          value={localStyle.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(34, 211, 238, 0.2)',
            borderRadius: '8px',
            color: '#FFFFFF',
            fontSize: '14px',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2322d3ee' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '36px'
          }}
        >
          <option value="Arial" style={{ background: '#1a2032', color: '#FFFFFF' }}>Arial</option>
          <option value="Helvetica" style={{ background: '#1a2032', color: '#FFFFFF' }}>Helvetica</option>
          <option value="Times New Roman" style={{ background: '#1a2032', color: '#FFFFFF' }}>Times New Roman</option>
          <option value="Georgia" style={{ background: '#1a2032', color: '#FFFFFF' }}>Georgia</option>
          <option value="Courier New" style={{ background: '#1a2032', color: '#FFFFFF' }}>Courier New</option>
          <option value="Verdana" style={{ background: '#1a2032', color: '#FFFFFF' }}>Verdana</option>
          <option value="Impact" style={{ background: '#1a2032', color: '#FFFFFF' }}>Impact</option>
        </select>
      </div>

      {/* Font Weight */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Font Weight
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {['normal', '600', 'bold'].map(weight => (
            <button
              key={weight}
              onClick={() => updateStyle({ fontWeight: weight })}
              style={{
                padding: '8px',
                background: localStyle.fontWeight === weight
                  ? 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: weight,
                transition: 'all 0.2s'
              }}
            >
              {weight === 'normal' ? 'Regular' : weight === '600' ? 'Semi' : 'Bold'}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Text Color
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
          {colorPresets.map(color => (
            <button
              key={color}
              onClick={() => updateStyle({ color })}
              style={{
                width: '100%',
                height: '36px',
                background: color,
                border: localStyle.color === color ? '2px solid #22d3ee' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: localStyle.color === color ? '0 0 12px rgba(34, 211, 238, 0.5)' : 'none',
                transform: localStyle.color === color ? 'scale(1.05)' : 'scale(1)'
              }}
            />
          ))}
        </div>
        <input
          type="color"
          value={localStyle.color}
          onChange={(e) => updateStyle({ color: e.target.value })}
          style={{
            width: '100%',
            height: '40px',
            border: '1px solid rgba(34, 211, 238, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            background: 'transparent'
          }}
        />
      </div>

      {/* Background Color */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Background
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => updateStyle({ backgroundColor: 'transparent' })}
            style={{
              flex: 1,
              padding: '10px',
              background: localStyle.backgroundColor === 'transparent'
                ? 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              border: '1px solid rgba(34, 211, 238, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            None
          </button>
          <input
            type="color"
            value={localStyle.backgroundColor === 'transparent' ? '#000000' : localStyle.backgroundColor}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
            style={{
              width: '60px',
              height: '40px',
              border: '1px solid rgba(34, 211, 238, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              background: 'transparent'
            }}
          />
        </div>
      </div>

      {/* Text Align */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: '12px', 
          fontWeight: '600',
          display: 'block',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Alignment
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { value: 'left', icon: '⬅️', label: 'Left' },
            { value: 'center', icon: '↔️', label: 'Center' },
            { value: 'right', icon: '➡️', label: 'Right' }
          ].map(align => (
            <button
              key={align.value}
              onClick={() => updateStyle({ textAlign: align.value })}
              style={{
                padding: '10px',
                background: localStyle.textAlign === align.value
                  ? 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>{align.icon}</span>
              <span>{align.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}