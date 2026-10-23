/** Shared vector artwork for the live character and the standalone public SVGs. */
export const coVariants = ['spark', 'buddy', 'sprout', 'comet'] as const
export type CoVariant = (typeof coVariants)[number]

interface CoArtworkProps {
  variant: CoVariant
  sleepy?: boolean
  curious?: boolean
  thinking?: boolean
  celebrating?: boolean
  waving?: boolean
}

const ink = '#49291C'

export function CoArtwork({ variant, sleepy, curious, thinking, celebrating, waving }: CoArtworkProps) {
  const arm = variant === 'spark' ? '#C45A18' : variant === 'buddy' ? '#C45A18' : variant === 'sprout' ? '#C45A18' : '#C45A18'
  return <g className="ds-co-body" opacity={sleepy ? .65 : 1}>
    <g fill={arm}>
      <path className={waving ? 'ds-co-wave' : undefined} d={waving || celebrating ? 'M46 124C27 123 15 99 22 88C30 78 43 98 52 111Z' : 'M47 125C34 110 18 111 18 123C18 138 34 147 49 140Z'} />
      <path d={celebrating ? 'M154 124C173 123 185 99 178 88C170 78 157 98 148 111Z' : 'M153 125C166 110 182 111 182 123C182 138 166 147 151 140Z'} />
    </g>
    {variant === 'spark' && <g>
      <path d="M109 24C114 46 139 69 167 87Q180 94 167 106C142 126 122 146 109 177Q101 191 92 177C75 149 57 125 31 111Q17 104 30 92C55 79 77 61 91 29Q100 12 109 24Z" fill="#FFAB61" />
      <path d="M109 24C114 46 139 69 167 87Q180 94 167 106C142 126 122 146 109 177Q101 191 92 177L77 153C111 159 140 125 143 101C144 78 119 66 109 24Z" fill="#E5782C" />
      <ellipse cx="69" cy="76" rx="16" ry="7" transform="rotate(-42 69 76)" fill="#FFE1BB" />
    </g>}
    {variant === 'buddy' && <g>
      <path d="M100 55L107 29" fill="none" stroke="#C45A18" strokeWidth="11" strokeLinecap="round" />
      <circle cx="110" cy="24" r="13" fill="#F6B64E" /><circle cx="106" cy="20" r="4" fill="#FFE1A6" />
      <path d="M100 47C138 47 165 75 165 116C165 155 141 179 100 179S35 155 35 116C35 75 62 47 100 47Z" fill="#F79A48" />
      <path d="M46 152C75 138 119 145 153 157C142 172 124 179 100 179C76 179 57 170 46 152Z" fill="#C45A18" />
      <ellipse cx="72" cy="71" rx="17" ry="8" transform="rotate(-33 72 71)" fill="#FFD9AD" />
      <rect x="53" y="83" width="94" height="62" rx="31" fill="#FFF4E2" />
    </g>}
    {variant === 'sprout' && <g>
      <ellipse cx="77" cy="169" rx="12" ry="9" fill="#C45A18" /><ellipse cx="123" cy="169" rx="12" ry="9" fill="#C45A18" />
      <path d="M101 62C68 65 45 45 43 24C73 20 98 35 101 62Z" fill="#FFB36E" />
      <path d="M100 62C99 34 122 18 154 24C154 48 132 65 100 62Z" fill="#D96A20" />
      <path d="M100 54C107 71 123 74 137 87C154 102 161 119 156 140C151 164 128 176 100 176S49 164 44 140C39 119 46 102 63 87C77 74 93 71 100 54Z" fill="#FFA059" />
      <path d="M100 54C107 71 123 74 137 87C154 102 161 119 156 140C151 164 128 176 100 176C128 152 135 113 115 85C106 73 100 65 100 54Z" fill="#E5782C" />
      <ellipse cx="68" cy="94" rx="16" ry="7" transform="rotate(-36 68 94)" fill="#FFDCB3" />
    </g>}
    {variant === 'comet' && <g>
      <path d="M120 25C141 6 176 23 176 57C177 88 160 100 160 128C159 159 137 178 105 178C64 178 37 152 38 119C39 87 67 69 106 62C130 58 147 45 139 35C135 29 126 30 120 33Q111 34 120 25Z" fill="#FFAD63" />
      <path d="M120 25C141 6 176 23 176 57C177 88 160 100 160 128C159 159 137 178 105 178C123 164 148 137 148 108C148 83 135 76 113 73C153 63 166 29 120 25Z" fill="#DB6C21" />
      <path d="M43 136C65 168 113 168 145 139C133 163 120 174 105 178C75 178 51 163 43 136Z" fill="#EE8938" />
      <ellipse cx="65" cy="98" rx="17" ry="8" transform="rotate(-38 65 98)" fill="#FFE1BB" />
      <path d="M158 65Q163 58 166 67L170 79L182 84Q189 88 181 93L170 98L166 111Q163 118 158 110L151 100L138 100Q130 99 135 92L143 82L142 70Q142 62 149 66L156 70Z" fill="#FFD36C" />
      <path d="M147 74L156 78L162 72L163 85L155 90Z" fill="#FFE7A3" />
    </g>}
    <g transform={variant === 'comet' ? 'translate(-7 7)' : undefined}>
      {sleepy ? <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round"><path d="M68 111q8 7 16 0m32 0q8 7 16 0" /></g> : <g>
        {variant === 'sprout' || celebrating ? <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round"><path d="M68 112c0-14 17-14 17 0m30 0c0-14 17-14 17 0" /></g> : <g fill={variant === 'buddy' ? '#49291C' : ink}>
          <ellipse cx="77" cy={thinking ? 103 : 110} rx="8" ry={curious ? 12 : 10} /><ellipse cx="123" cy={thinking ? 103 : 110} rx="8" ry={curious ? 12 : 10} />
          <circle cx="80" cy={thinking ? 99 : 106} r="2.7" fill="#FFF" /><circle cx="126" cy={thinking ? 99 : 106} r="2.7" fill="#FFF" />
        </g>}
        {variant !== 'buddy' && <g fill="#F28C65"><circle cx="62" cy="125" r="7" /><circle cx="138" cy="125" r="7" /></g>}
      </g>}
      {sleepy ? <path d="M93 130q7 5 14 0" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" /> : curious ? <ellipse cx="100" cy="132" rx="5" ry="7" fill={ink} /> : <g>
        <path d="M89 127Q100 131 111 127C115 145 85 145 89 127Z" fill={ink} />
        <path d="M94 138Q100 131 107 138Q100 143 94 138Z" fill="#F28C65" />
      </g>}
    </g>
  </g>
}
