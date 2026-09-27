// Temporary switch for presenting both hero options to the client. Once one is
// chosen, delete this component and the losing variant in App.jsx.
const options = [
  { value: 'classic', label: 'Hero atual' },
  { value: 'cta', label: 'Hero nova' },
]

function HeroVariantToggle({ value, onChange }) {
  return (
    <div className="hero-toggle" role="group" aria-label="Versão da hero">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="hero-toggle__btn"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default HeroVariantToggle
