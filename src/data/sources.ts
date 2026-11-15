export interface DataSourceEntry {
  id: string;
  name: string;
  publisher: string;
  url: string;
  usedFor: string;
  creditLine: string;
  retrievedOn: string;
}

export const DATA_SOURCES: DataSourceEntry[] = [
  {
    id: 'nasa-open-apis',
    name: 'NASA Open APIs Portal',
    publisher: 'NASA',
    url: 'https://api.nasa.gov',
    usedFor: 'Server-side access to the DONKI space-weather endpoints (FLR, CME, GST, SEP).',
    creditLine: 'Data retrieved via NASA Open APIs.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-donki',
    name: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)',
    publisher: 'Community Coordinated Modeling Center (CCMC), NASA Goddard Space Flight Center',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    usedFor:
      'Latest reported solar flares (FLR), coronal mass ejections (CME), geomagnetic storms (GST, Kp index), solar energetic particles (SEP), and scenario weighting.',
    creditLine:
      'We acknowledge the Community Coordinated Modeling Center (CCMC) at Goddard Space Flight Center for the use of DONKI. The Moon to Mars Space Weather Analysis Office and other entities provide data to DONKI as a courtesy to the community.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'donki-disclaimer',
    name: 'DONKI Disclaimer & Terms of Use',
    publisher: 'NASA CCMC (hosted at ccmc.gsfc.nasa.gov; legacy kauai.ccmc.gsfc.nasa.gov timed out)',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/#disclaimer',
    usedFor: 'As-is experimental research status and non-endorsement notice for DONKI data.',
    creditLine: 'DONKI data and information are preliminary, experimental research information provided "as is".',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'ccmc-publication-policy',
    name: 'CCMC Publications & Acknowledgment Policy',
    publisher: 'NASA CCMC',
    url: 'https://ccmc.gsfc.nasa.gov/publication-policy/',
    usedFor: 'Courtesy acknowledgment wording for CCMC tools and models.',
    creditLine: 'Acknowledgment follows CCMC community guidelines.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-media-guidelines',
    name: 'NASA Media Usage Guidelines & Brand Center',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    usedFor: 'Rules for educational use, NASA attribution, and avoiding NASA insignia or implied endorsement.',
    creditLine: 'Starbound Outpost is independent and not affiliated with or endorsed by NASA.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-osdr',
    name: 'NASA Open Science Data Repository (OSDR)',
    publisher: 'NASA Biological and Physical Sciences',
    url: 'https://osdr.nasa.gov',
    usedFor: 'Space biology & hydroponics plant-microbe context and featured Veggie study (OSD-412).',
    creditLine: 'GeneLab data are courtesy of the NASA GeneLab Data Repository.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-osdr-terms',
    name: 'NASA OSDR Help, Terms & Conditions',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/reference/osdr-help-terms-and-conditions/',
    usedFor: 'Usage terms and study citation practices for OSDR datasets.',
    creditLine: 'OSDR terms and third-party investigator attribution requirements.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'osdr-study-412',
    name: 'OSDR Study OSD-412 (ISS Veggie Leafy Greens Microbiome)',
    publisher: 'NASA OSDR / GeneLab',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-412',
    usedFor: 'Featured real Veggie plant-microbe spaceflight study linked in the Codex.',
    creditLine: 'GeneLab data are courtesy of the NASA GeneLab Data Repository (Study OSD-412).',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'noaa-swpc',
    name: 'NOAA Space Weather Prediction Center (SWPC)',
    publisher: 'National Oceanic and Atmospheric Administration (NOAA)',
    url: 'https://www.spaceweather.gov/',
    usedFor: 'Official U.S. government space-weather forecasts and alerts.',
    creditLine: 'For official space-weather forecasts, see NOAA Space Weather Prediction Center.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'moon-fact-sheet',
    name: 'NASA Moon Fact Sheet (NSSDCA)',
    publisher: 'NASA Goddard Space Flight Center',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    usedFor: 'Lunar surface gravity (~0.166g / 1.62 m/s²) and ~29.5-day lunar day/night cycle.',
    creditLine: 'NASA Space Science Data Coordinated Archive (NSSDCA) Moon Fact Sheet.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'mars-facts',
    name: 'Mars Facts (Sol Duration, Gravity & CO2 Atmosphere)',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mars/facts/',
    usedFor: 'Martian Sol (~24.6 hours), ~0.38g surface gravity, and carbon-dioxide atmosphere.',
    creditLine: 'NASA Science Mars Planetary Facts.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'lro-mission',
    name: 'Lunar Reconnaissance Orbiter (LRO) Mission',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mission/lro/',
    usedFor: 'Lunar South Pole temperatures, permanently shadowed craters, and radiation context (~1.36 mSv/day unshielded estimate).',
    creditLine: 'NASA Lunar Reconnaissance Orbiter (LRO) Mission.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'artemis-program',
    name: 'Artemis Lunar Exploration Overview',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/humans-in-space/artemis/',
    usedFor: 'Lunar South Pole outpost engineering and dust mitigation context.',
    creditLine: 'NASA Artemis Program overview.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'curiosity-rad',
    name: 'Mars Science Laboratory Curiosity Instruments (RAD)',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mission/msl-curiosity/science-instruments/',
    usedFor: 'Martian surface radiation context (roughly 0.67 mSv/day / ~240 mSv/yr unshielded estimate).',
    creditLine: 'NASA Mars Science Laboratory Curiosity Radiation Assessment Detector (RAD).',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'perseverance-mars',
    name: 'Mars 2020 Perseverance Rover (MEDA & MOXIE)',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
    usedFor: 'Static inspiration for Martian dust storm (MEDA) and CO2-to-O2 (MOXIE) scenarios.',
    creditLine: 'NASA Mars 2020 Perseverance Rover mission.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-radlab-osdr',
    name: 'RadLab (OSDR Radiation Dosimetry Database)',
    publisher: 'NASA Open Science Data Repository (OSDR)',
    url: 'https://osdr.nasa.gov/bio/repo/data/payloads',
    usedFor:
      'Absorbed dose rate measurements recorded by ISS dosimetry instruments (ALTEA, DOSTEL, TEPC, RAD) for the EVA Timer & Shielding Planner.',
    creditLine: 'Radiation dosimetry data courtesy of NASA OSDR RadLab.',
    retrievedOn: '2026-11-14',
  },
  {
    id: 'nasa-osdr-musculoskeletal',
    name: 'OSDR Spaceflight Musculoskeletal & Countermeasure Studies',
    publisher: 'NASA Open Science Data Repository (OSDR) / GeneLab',
    url: 'https://osdr.nasa.gov/bio/repo/search?q=bone+density+muscle+atrophy',
    usedFor:
      'Quantitative bone mineral density (~1.0–1.5%/mo unmitigated) and muscle mass loss rates for the Crew Conditioning & Countermeasure Scheduler.',
    creditLine: 'Musculoskeletal biology data courtesy of NASA Open Science Data Repository (OSDR).',
    retrievedOn: '2026-11-14',
  },
];
