function makePlaceholder(width, height, bg, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${bg}"/><text x="${Math.floor(width / 2)}" y="${Math.floor(height / 2)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="16" fill="rgba(255,255,255,0.6)">${label}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const heroImage = makePlaceholder(600, 750, '#c4a0b8', 'Foto')
export const aboutImage = makePlaceholder(500, 600, '#cca8bc', 'Sobre')
export const gynImage = makePlaceholder(500, 400, '#d4b0c8', 'Ginecologia')
export const obstImage = makePlaceholder(500, 400, '#c8b0d4', 'Obstetrícia')
export const homeoImage = makePlaceholder(500, 400, '#b8b0d4', 'Homeopatia')
export const testimonialRandomOne = makePlaceholder(80, 80, '#d4b8c8', 'L')
export const testimonialRandomTwo = makePlaceholder(80, 80, '#c8b8d4', 'R')
export const testimonialRandomThree = makePlaceholder(80, 80, '#b8c8d4', 'P')
export const iphoneMapImage = makePlaceholder(390, 844, '#d0c8e0', 'Mapa')
