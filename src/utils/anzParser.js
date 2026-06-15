const SMALL_WORDS = new Set(['&', 'and', 'or', 'the', 'a', 'an', 'at', 'by', 'for', 'in', 'of', 'on', 'to', 'vs'])

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w+/g, (word, idx) =>
    idx === 0 || !SMALL_WORDS.has(word) ? word[0].toUpperCase() + word.slice(1) : word
  )
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += ch
  }
  result.push(current.trim())
  return result
}

// Order matters: more specific categories are checked before broader ones.
// Patterns are matched as uppercase substrings of the raw description.
const MERCHANT_RULES = [
  // ── Subscriptions (checked before shopping so "AMAZON PRIME" wins) ──
  { category: 'subscriptions', patterns: [
    'NETFLIX', 'SPOTIFY', 'DISNEY', 'DISNEYPLUS', 'AMAZON PRIME', 'PRIME VIDEO', 'STAN.COM', 'BINGE', 'FOXTEL', 'KAYO', 'PARAMOUNT',
    'APPLE.COM/BILL', 'APPLE MUSIC', 'ITUNES', 'ICLOUD', 'YOUTUBEPREMIUM', 'YOUTUBE PREMIUM', 'GOOGLE STORAGE', 'GOOGLE*', 'GOOGLE ONE',
    'MICROSOFT', 'OFFICE 365', 'MICROSOFT 365', 'ADOBE', 'DROPBOX', 'CANVA', 'NOTION', 'CHATGPT', 'OPENAI', 'ANTHROPIC', 'CLAUDE.AI',
    'AUDIBLE', 'PATREON', 'SUBSTACK', 'LINKEDIN', 'NINTENDO', 'PLAYSTATION', 'PLAYSTATIONNETWORK', 'XBOX', 'STEAMGAMES', 'TWITCH',
    'NYTIMES', 'THE AGE', 'NEWS LIMITED', 'AUDIOBOOK', 'DUOLINGO', 'STRAVA', 'AMAZON KINDLE'
  ] },
  // ── Insurance ──
  { category: 'insurance', patterns: [
    'NRMA', 'AAMI', 'ALLIANZ', 'BUDGET DIRECT', 'YOUI', 'RACV', 'RACQ', 'RAC INSURANCE', 'SUNCORP', 'GIO', 'QBE', 'AIA', 'TAL ',
    'BINGLE', 'APIA', 'REAL INSURANCE', 'WOOLWORTHS INSURANCE', 'COLES INSURANCE', 'INSURANCE', 'COMPARETHEMARKET'
  ] },
  // ── Utilities (energy / water / telco / internet) ──
  { category: 'utilities', patterns: [
    'ORIGIN ENERGY', 'AGL', 'ENERGYAUSTRALIA', 'ENERGY AUSTRALIA', 'RED ENERGY', 'ALINTA', 'ACTEWAGL', 'SIMPLY ENERGY', 'POWERSHOP', 'ERGON', 'MOMENTUM ENERGY',
    'TELSTRA', 'OPTUS', 'VODAFONE', 'TPG', 'AUSSIE BROADBAND', 'IINET', 'BELONG', 'SUPERLOOP', 'DODO', 'TANGERINE', 'MORE TELECOM', 'AMAYSIM', 'BOOST MOBILE', 'FELIX MOBILE',
    'SYDNEY WATER', 'ICON WATER', 'YARRA VALLEY WATER', 'SA WATER', 'WATER CORP', 'UNITYWATER'
  ] },
  // ── Groceries ──
  { category: 'groceries', patterns: [
    'WOOLWORTHS', 'COLES', 'ALDI', 'IGA', 'FOODWORKS', 'SUPABARN', 'COSTCO', 'HARRIS FARM', 'METCASH', 'DRAKES', 'FRIENDLY GROCER', 'SPUDSHED', 'NQR', 'SUPA IGA'
  ] },
  // ── Transport (rideshare / fuel / tolls / parking / public transport) ──
  { category: 'transport', patterns: [
    'UBER *TRIP', 'UBER TRIP', 'OLA ', 'DIDI', 'SHEBAH', '13CABS', 'TAXI', 'CABCHARGE',
    'OPAL', 'MYKI', 'GO CARD', 'TRANSPORT FOR NSW', 'TRANSPORTNSW', 'PTV ', 'METRO TRAINS', 'TRANSLINK',
    'LINKT', 'E-TOLL', 'ETOLL', 'EASTLINK', 'CITYLINK', 'TOLL',
    'BP ', 'SHELL', 'CALTEX', 'AMPOL', '7-ELEVEN', 'UNITED PETROLEUM', 'METRO PETROLEUM', 'MOBIL', 'LIBERTY', 'OTR ', 'COSTCO FUEL', 'PUMA ENERGY', 'EG FUEL',
    'WILSON PARKING', 'SECURE PARKING', 'CARE PARK', 'POINTPARKING', 'PARKING', 'CITY OF SYDNEY PARK'
  ] },
  // ── Dining / cafes / takeaway / delivery ──
  { category: 'dining', patterns: [
    'MCDONALD', 'KFC', 'HUNGRY JACK', 'GUZMAN', 'GYG', 'DOMINO', 'PIZZA', 'NANDOS', 'SUBWAY', "GRILL'D", 'GRILLD', 'ZAMBRERO', 'RED ROOSTER', 'OPORTO', 'BETTY', 'SUSHI', 'GAMI', 'MANOOSH',
    'UBER *EATS', 'UBER EATS', 'UBEREATS', 'MENULOG', 'DELIVEROO', 'DOORDASH', 'EASI ',
    'STARBUCKS', 'GLORIA JEAN', 'GONG CHA', 'SHARETEA', 'CHATIME', 'BOOST JUICE',
    'CAFE', 'COFFEE', 'RESTAURANT', 'BAR ', 'BAKERY', 'BAKEHOUSE', 'KEBAB', 'BURGER', 'NOODLE', 'THAI', 'INDIAN', 'CHINESE', 'BISTRO', 'TAVERN', 'BREWERY', 'PUB',
    'LOKMA', 'KINGSLEY', 'NOI NOI', 'BARTON KEBAB', 'PENNYWORTH', 'ANTAKYA', ' HJS', 'YOGIS KITCHEN', 'EQ BAKEHOUSE', 'MR SHISH', 'BIANCO DOME'
  ] },
  // ── Health / pharmacy / medical ──
  { category: 'health', patterns: [
    'MEDIBANK', 'BUPA', 'NIB', 'HCF', 'AHM', 'AUSTRALIAN UNITY',
    'CHEMIST WAREHOUSE', 'CHEMIST', 'PHARMACY', 'PRICELINE', 'TERRY WHITE', 'AMCAL', 'GUARDIAN PHARM',
    'MEDICAL', 'DENTAL', 'DENTIST', 'PHYSIO', 'OPTOMETRIST', 'SPECSAVERS', 'OPSM', 'PATHOLOGY', 'CLINIC', 'HOSPITAL', 'DR ', 'PSYCHOLOG', 'CHIROPRACT'
  ] },
  // ── Fitness ──
  { category: 'fitness', patterns: [
    'ANYTIME FITNESS', 'FITNESS FIRST', 'GOODLIFE', 'JETTS', 'F45', 'SNAP FITNESS', 'PLUS FITNESS', 'CROSSFIT', 'GYM', 'YMCA', 'CLASSPASS', 'PILATES', 'YOGA', 'AQUATIC', 'LEISURE CENTRE'
  ] },
  // ── Shopping / retail (after subscriptions so Amazon Prime is excluded) ──
  { category: 'shopping', patterns: [
    'KMART', 'TARGET', 'BIG W', 'BUNNINGS', 'IKEA', 'JB HI-FI', 'JBHIFI', 'HARVEY NORMAN', 'OFFICEWORKS', 'THE GOOD GUYS', 'MYER', 'DAVID JONES',
    'COTTON ON', 'UNIQLO', 'H&M', 'ZARA', 'COUNTRY ROAD', 'GENERAL PANTS', 'UNIVERSAL STORE', 'THE ICONIC', 'ASOS',
    'MECCA', 'SEPHORA', 'CHEMIST WAREHOUSE BEAUTY',
    'REBEL', 'BCF', 'SUPERCHEAP', 'ANACONDA', 'CATCH', 'KOGAN', 'TEMU', 'SHEIN', 'EBAY', 'ETSY', 'AMAZON MKTP', 'AMZN MKTP', 'AMAZON AU', 'AMAZON.COM.AU', 'APPLE STORE', 'AFTERPAY', 'ZIPPAY', 'ZIP*', 'ZIPMONEY'
  ] },
  // ── Entertainment / events / gambling ──
  { category: 'entertainment', patterns: [
    'TICKETEK', 'TICKETMASTER', 'EVENTBRITE', 'MOSHTIX', 'HOYTS', 'EVENT CINEMAS', 'VILLAGE CINEMAS', 'DENDY', 'PALACE CINEMA', 'CINEMA',
    'SPORTSBET', 'TAB', 'BET365', 'LADBROKES', 'NEDS', 'POINTSBET', 'DABBLE', 'BETEASY',
    'RSL ART UNION', 'TOY FARM', 'VENUES CANBERRA', 'BRUMBIES', 'LMCT', 'GOLF', 'BOWLING', 'ZOO', 'AQUARIUM', 'MUSEUM'
  ] },
  // ── Housing / rent / rates ──
  { category: 'housing', patterns: [
    'RAY WHITE', 'LJ HOOKER', 'REAL ESTATE', 'PROPERTY MANAGE', 'RENTAL', 'STRATA', 'COUNCIL RATES', 'CITY COUNCIL', 'SHIRE COUNCIL', 'BODY CORP'
  ] },
  // ── Education ──
  { category: 'education', patterns: [
    'UNIVERSITY', 'TAFE', 'UDEMY', 'COURSERA', 'SKILLSHARE', 'TEXTBOOK', 'STUDENT', 'TUITION', 'CHILDCARE', 'EARLY LEARNING', 'KINDERGARTEN'
  ] },
  // ── Gifts / donations / charity ──
  { category: 'gifts', patterns: [
    'RED CROSS', 'UNICEF', 'WORLD VISION', 'RSPCA', 'SALVATION ARMY', 'SALVOS', 'GOFUNDME', 'DONATION', 'OXFAM', 'CANCER COUNCIL', 'BEYOND BLUE', 'SMITH FAMILY'
  ] },
  // ── Personal care ──
  { category: 'personal_care', patterns: [
    'HAIRDRESS', 'BARBER', 'SALON', 'NAILS', 'SPA ', 'BEAUTY', 'WAXING', 'BROW', 'LASH', 'MASSAGE'
  ] },
  // ── Bank fees / charges ──
  { category: 'fees', patterns: [
    'ACCOUNT FEE', 'ANNUAL FEE', 'MONTHLY FEE', 'SERVICE FEE', 'OVERDRAWN', 'DISHONOUR', 'LATE FEE', 'FOREIGN TRANSACTION', 'INTERNATIONAL TRANSACTION', 'INTEREST CHARGE', 'CASH ADVANCE FEE'
  ] },
]

function categoriseRaw(raw, type) {
  if (type === 'income') return 'income'
  const up = raw.toUpperCase()
  for (const { category, patterns } of MERCHANT_RULES) {
    if (patterns.some(p => up.includes(p))) return category
  }
  return 'other'
}

function cleanAndCategorise(raw, amountValue) {
  let desc = raw.trim()
  const isExpense = amountValue < 0
  let notes = null
  let isInternal = false
  let type = isExpense ? 'expense' : 'income'

  // ── ATM ────────────────────────────────────────────────────────
  if (/^(NON-ANZ ATM|ANZ ATM)/i.test(desc)) {
    const fee = desc.match(/\$?(\d+\.\d{2})\s*FEE/i)
    return {
      description: 'ATM Withdrawal',
      type: 'expense',
      category: 'other',
      notes: fee ? `Includes $${fee[1]} ATM fee` : null,
      isInternal: false
    }
  }

  // ── Own account transfer ────────────────────────────────────────
  if (/^ANZ M-BANKING FUNDS TFER\s+TRANSFER\s+\S+\s+TO\s+\d/i.test(desc)) {
    return { description: 'Own Account Transfer', type: 'expense', category: 'other', notes: null, isInternal: true }
  }

  // ── Recurring / generic bank transfer ──────────────────────────
  if (/^ANZ MOBILE BANKING RECURRING PAYMENT/i.test(desc)) {
    return { description: 'Bank Transfer', type: 'expense', category: 'other', notes: null, isInternal: false }
  }

  // ── Salary ─────────────────────────────────────────────────────
  const salaryMatch = desc.match(/^PAY\/SALARY FROM (.+)/i)
  if (salaryMatch) {
    return { description: toTitleCase(salaryMatch[1].trim()), type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── ANZ Mobile Banking payment to person ───────────────────────
  const mobilePayMatch = desc.match(/^ANZ MOBILE BANKING PAYMENT \S+ TO (.+)/i)
  if (mobilePayMatch) {
    const payee = mobilePayMatch[1].trim()
    return { description: `Transfer to ${toTitleCase(payee)}`, type: 'expense', category: 'savings', notes: null, isInternal: false }
  }

  // ── ANZ M-Banking transfer ──────────────────────────────────────
  if (/^ANZ M-BANKING/i.test(desc)) {
    return { description: 'Bank Transfer', type: 'expense', category: 'other', notes: null, isInternal: true }
  }

  // ── PAYMENT TO ─────────────────────────────────────────────────
  const payToMatch = desc.match(/^PAYMENT TO (.+)/i)
  if (payToMatch) {
    const payee = payToMatch[1].trim()
    if (/COLES CR CARD|MYCARD CR CARD|ZIPMONEY|CREDIT CARD/i.test(payee)) {
      return { description: 'Credit Card Payment', type: 'expense', category: 'other', notes: null, isInternal: true }
    }
    if (/^(NIB|MEDIBANK|BUPA|AUTOPAY)/i.test(payee)) {
      return { description: toTitleCase(payee), type: 'expense', category: 'health', notes: null, isInternal: false }
    }
    return { description: toTitleCase(payee), type: 'expense', category: 'savings', notes: null, isInternal: false }
  }

  // ── PAYMENT FROM ───────────────────────────────────────────────
  const payFromMatch = desc.match(/^PAYMENT FROM (.+)/i)
  if (payFromMatch) {
    return { description: toTitleCase(payFromMatch[1].trim()), type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── Tabcorp (gambling winnings) ────────────────────────────────
  if (/TABCORP/i.test(desc)) {
    return { description: 'Tabcorp', type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── Standard merchant cleanup ───────────────────────────────────
  desc = desc.replace(/^VISA DEBIT PURCHASE CARD \d+\s*/i, '')
  desc = desc.replace(/^EFTPOS\s+/i, '')

  // Remove trailing location: split on first double-space occurrence
  const parts = desc.split(/\s{2,}/)
  desc = parts[0].trim()

  // Remove trailing store number (e.g. "COLES 0397")
  desc = desc.replace(/\s+\d{3,}$/, '')

  desc = toTitleCase(desc)

  return {
    description: desc,
    type,
    category: categoriseRaw(raw, type),
    notes: null,
    isInternal: false
  }
}

export function parseAnzCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim())
  const rows = []

  for (const line of lines) {
    const cols = parseCsvLine(line)
    if (cols.length < 3) continue

    const [dateStr, amountStr, rawDesc] = cols

    // Parse DD/MM/YYYY → YYYY-MM-DD
    const dm = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (!dm) continue

    const date = `${dm[3]}-${dm[2]}-${dm[1]}`
    const amountValue = parseFloat(amountStr.replace(/[^-\d.]/g, ''))
    if (isNaN(amountValue)) continue

    const { description, type, category, notes, isInternal } = cleanAndCategorise(rawDesc, amountValue)

    rows.push({
      date,
      amount: Math.abs(amountValue).toFixed(2),
      description,
      type,
      category,
      notes,
      isInternal,
      rawDescription: rawDesc,
      selected: true
    })
  }

  return rows
}
