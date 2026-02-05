import { useState } from "react"

export default function TextEditorModal({ isOpen, onClose, onSave }) {
  const [textContent, setTextContent] = useState("")
  const [fontSize, setFontSize] = useState(32)
  const [fontFamily, setFontFamily] = useState("Arial")
  const [textColor, setTextColor] = useState("#FFFFFF")
  const [bgColor, setBgColor] = useState("transparent")
  const [textAlign, setTextAlign] = useState("center")
  const [fontWeight, setFontWeight] = useState("normal")
  const [textStyle, setTextStyle] = useState("plain")

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      text: textContent,
      fontSize,
      fontFamily,
      color: textColor,
      backgroundColor: bgColor,
      textAlign,
      fontWeight,
      style: textStyle
    })
    onClose()
  }

  const textStyles = [
    { id: "plain", name: "Plain Text" },
    { id: "heading", name: "Heading", weight: "bold", size: 48 },
    { id: "subheading", name: "Subheading", weight: "600", size: 36 },
    { id: "body", name: "Body Text", size: 24 },
    { id: "caption", name: "Caption", size: 18 }
  ]

  const fontCombinations = [
    { name: "Modern", fonts: ["Helvetica", "Arial", "sans-serif"] },
    { name: "Classic", fonts: ["Georgia", "Times New Roman", "serif"] },
    { name: "Playful", fonts: ["Comic Sans MS", "cursive"] },
    { name: "Bold", fonts: ["Impact", "Arial Black", "sans-serif"] }
  ]

  const applyStyle = (style) => {
    setTextStyle(style.id)
    if (style.weight) setFontWeight(style.weight)
    if (style.size) setFontSize(style.size)
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "#1a1a2e",
        borderRadius: "12px",
        padding: "30px",
        width: "90%",
        maxWidth: "800px",
        maxHeight: "90vh",
        overflow: "auto",
        border: "1px solid rgba(255, 255, 255, 0.1)"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 style={{ margin: 0, color: "white" }}>Add Text</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              fontSize: "24px",
              cursor: "pointer"
            }}
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div style={{
          background: "#0f0f1e",
          borderRadius: "8px",
          padding: "40px",
          marginBottom: "30px",
          minHeight: "150px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden"
        }}>
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setTextContent(e.currentTarget.textContent)}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              color: textColor,
              backgroundColor: bgColor,
              textAlign: textAlign,
              fontWeight: fontWeight,
              padding: bgColor !== "transparent" ? "10px 20px" : "0",
              borderRadius: "8px",
              outline: "none",
              minWidth: "200px",
              cursor: "text"
            }}
          >
            {textContent || "Click to add text"}
          </div>
        </div>

        {/* Quick Styles */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ color: "white", display: "block", marginBottom: "10px", fontSize: "14px" }}>
            Text Styles
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {textStyles.map(style => (
              <button
                key={style.id}
                onClick={() => applyStyle(style)}
                style={{
                  padding: "8px 16px",
                  background: textStyle === style.id ? "#3b82f6" : "#2a2a4a",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                {style.name}
              </button>
            ))}
          </div>
        </div>

        {/* Font Combinations */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ color: "white", display: "block", marginBottom: "10px", fontSize: "14px" }}>
            Font Combinations
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
            {fontCombinations.map(combo => (
              <button
                key={combo.name}
                onClick={() => setFontFamily(combo.fonts.join(", "))}
                style={{
                  padding: "15px",
                  background: "#2a2a4a",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontFamily: combo.fonts[0]
                }}
              >
                {combo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px"
        }}>
          {/* Font Size */}
          <div>
            <label style={{ color: "white", display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="120"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Text Color */}
          <div>
            <label style={{ color: "white", display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Text Color
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: "50px", height: "40px", border: "none", borderRadius: "4px" }}
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "#2a2a4a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  color: "white"
                }}
              />
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label style={{ color: "white", display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Background Color
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="color"
                value={bgColor === "transparent" ? "#000000" : bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ width: "50px", height: "40px", border: "none", borderRadius: "4px" }}
              />
              <button
                onClick={() => setBgColor("transparent")}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: bgColor === "transparent" ? "#3b82f6" : "#2a2a4a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  color: "white"
                }}
              >
                Transparent
              </button>
            </div>
          </div>

          {/* Text Align */}
          <div>
            <label style={{ color: "white", display: "block", marginBottom: "5px", fontSize: "14px" }}>
              Text Align
            </label>
            <div style={{ display: "flex", gap: "5px" }}>
              {["left", "center", "right"].map(align => (
                <button
                  key={align}
                  onClick={() => setTextAlign(align)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: textAlign === align ? "#3b82f6" : "#2a2a4a",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "#2a2a4a",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "12px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Add Text
          </button>
        </div>
      </div>
    </div>
  )
}