export function getSeriesColor(index) {
  // Predefined distinct hues in stable order
  const baseHues = [
    240, // Blue
    0, // Red
    120, // Green
    180, // Cyan
    30, // Orange-red
    270, // Purple
    300, // Magenta
    210, // Light blue
    150, // Spring green
    60, // Yellow
    330, // Pink
    90, // Yellow-green
  ]

  // Use modulo to cycle through colors if more than 12 series
  const hue = baseHues[index % baseHues.length]

  // Consistent saturation and lightness for readability
  const saturation = 70
  const lightness = 45

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
