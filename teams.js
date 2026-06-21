const TOURNAMENTS = {
  leagues: {
  "England - Premier League": [
    { "id": "arsenal", "name": "Arsenal", "badge": "assets/badges/England-PremierLeague/arsenal.svg" },
    { "id": "astonvilla", "name": "Aston Villa", "badge": "assets/badges/England-PremierLeague/astonvilla.svg" },
    { "id": "bournemouth", "name": "Bournemouth", "badge": "assets/badges/England-PremierLeague/bournemouth.svg" },
    { "id": "brentford", "name": "Brentford", "badge": "assets/badges/England-PremierLeague/brentford.svg" },
    { "id": "brighton", "name": "Brighton", "badge": "assets/badges/England-PremierLeague/brighton.svg" },
    { "id": "chelsea", "name": "Chelsea", "badge": "assets/badges/England-PremierLeague/chelsea.svg" },
    { "id": "coventry", "name": "Coventry City", "badge": "assets/badges/England-PremierLeague/coventry.svg" },
    { "id": "crystalpal", "name": "Crystal Palace", "badge": "assets/badges/England-PremierLeague/crystalpal.svg" },
    { "id": "everton", "name": "Everton", "badge": "assets/badges/England-PremierLeague/everton.svg" },
    { "id": "fulham", "name": "Fulham", "badge": "assets/badges/England-PremierLeague/fulham.svg" },
    { "id": "hull", "name": "Hull City", "badge": "assets/badges/England-PremierLeague/hull.svg" },
    { "id": "ipswich", "name": "Ipswich Town", "badge": "assets/badges/England-PremierLeague/ipswich.svg" },
    { "id": "leeds", "name": "Leeds United", "badge": "assets/badges/England-PremierLeague/leeds.svg" },
    { "id": "liverpool", "name": "Liverpool", "badge": "assets/badges/England-PremierLeague/liverpool.svg" },
    { "id": "mancity", "name": "Manchester City", "badge": "assets/badges/England-PremierLeague/115.svg" },
    { "id": "manutd", "name": "Manchester United", "badge": "assets/badges/England-PremierLeague/manutd.svg" },
    { "id": "newcastle", "name": "Newcastle United", "badge": "assets/badges/England-PremierLeague/newcastle.svg" },
    { "id": "nforest", "name": "Nottingham Forest", "badge": "assets/badges/England-PremierLeague/nforest.svg" },
    { "id": "sunderland", "name": "Sunderland", "badge": "assets/badges/England-PremierLeague/sunderland.svg" },
    { "id": "tottenham", "name": "Tottenham Hotspur", "badge": "assets/badges/England-PremierLeague/tottenham.svg" }
  ],
  "France - Ligue 1": [
    { "id": "angers", "name": "Angers SCO", "badge": "assets/badges/France-Ligue1/angers.svg" },
    { "id": "auxerre", "name": "AJ Auxerre", "badge": "assets/badges/France-Ligue1/auxerre.svg" },
    { "id": "brest", "name": "Stade Brestois", "badge": "assets/badges/France-Ligue1/brest.svg" },
    { "id": "lehavre", "name": "Le Havre AC", "badge": "assets/badges/France-Ligue1/lehavre.svg" },
    { "id": "lemans", "name": "Le Mans", "badge": "assets/badges/France-Ligue1/lemans.svg" },
    { "id": "lens", "name": "RC Lens", "badge": "assets/badges/France-Ligue1/lens.svg" },
    { "id": "lille", "name": "Lille OSC", "badge": "assets/badges/France-Ligue1/lille.svg" },
    { "id": "lorient", "name": "Lorient", "badge": "assets/badges/France-Ligue1/lorient.svg" },
    { "id": "lyon", "name": "Lyon", "badge": "assets/badges/France-Ligue1/lyon.svg" },
    { "id": "marseille", "name": "Marseille", "badge": "assets/badges/France-Ligue1/marseille.svg" },
    { "id": "monaco", "name": "AS Monaco", "badge": "assets/badges/France-Ligue1/monaco.svg" },
    { "id": "nice", "name": "OGC Nice", "badge": "assets/badges/France-Ligue1/nice.svg" },
    { "id": "paris", "name": "Paris FC", "badge": "assets/badges/France-Ligue1/paris.svg" },
    { "id": "psg", "name": "Paris Saint-Germain", "badge": "assets/badges/France-Ligue1/psg.svg" },
    { "id": "rennes", "name": "Stade Rennais", "badge": "assets/badges/France-Ligue1/rennes.svg" },
    { "id": "strasbourg", "name": "RC Strasbourg", "badge": "assets/badges/France-Ligue1/strasbourg.svg" },
    { "id": "toulouse", "name": "Toulouse FC", "badge": "assets/badges/France-Ligue1/toulouse.svg" },
    { "id": "troyes", "name": "Troyes", "badge": "assets/badges/France-Ligue1/troyes.svg" }
  ],
  "Germany - Bundesliga": [
    { "id": "augsburg", "name": "FC Augsburg", "badge": "assets/badges/Germany-Bundesliga/augsburg.svg" },
    { "id": "bayern", "name": "Bayern Munich", "badge": "assets/badges/Germany-Bundesliga/bayern.svg" },
    { "id": "bremen", "name": "Werder Bremen", "badge": "assets/badges/Germany-Bundesliga/bremen.svg" },
    { "id": "dortmund", "name": "Borussia Dortmund", "badge": "assets/badges/Germany-Bundesliga/dortmund.svg" },
    { "id": "elversberg", "name": "Elversberg", "badge": "assets/badges/Germany-Bundesliga/elversberg.svg" },
    { "id": "frankfurt", "name": "Eintracht Frankfurt", "badge": "assets/badges/Germany-Bundesliga/frankfurt.svg" },
    { "id": "freiburg", "name": "SC Freiburg", "badge": "assets/badges/Germany-Bundesliga/freiburg.svg" },
    { "id": "gladbach", "name": "Mönchengladbach", "badge": "assets/badges/Germany-Bundesliga/gladbach.svg" },
    { "id": "hamburger", "name": "Hamburger SV", "badge": "assets/badges/Germany-Bundesliga/hamburger.svg" },
    { "id": "hoffenheim", "name": "TSG Hoffenheim", "badge": "assets/badges/Germany-Bundesliga/hoffenheim.svg" },
    { "id": "koln", "name": "1. FC Köln", "badge": "assets/badges/Germany-Bundesliga/koln.svg" },
    { "id": "leipzig", "name": "RB Leipzig", "badge": "assets/badges/Germany-Bundesliga/leipzig.svg" },
    { "id": "leverkusen", "name": "Bayer Leverkusen", "badge": "assets/badges/Germany-Bundesliga/leverkusen.svg" },
    { "id": "mainz", "name": "FSV Mainz 05", "badge": "assets/badges/Germany-Bundesliga/mainz.svg" },
    { "id": "paderborn", "name": "Paderborn", "badge": "assets/badges/Germany-Bundesliga/paderborn.svg" },
    { "id": "schalke", "name": "Schalke 04", "badge": "assets/badges/Germany-Bundesliga/schalke.svg" },
    { "id": "stuttgart", "name": "VfB Stuttgart", "badge": "assets/badges/Germany-Bundesliga/stuttgart.svg" },
    { "id": "union", "name": "Union Berlin", "badge": "assets/badges/Germany-Bundesliga/union.svg" }
  ],
  "Italy - Serie A": [
    { "id": "milan", "name": "AC Milan", "badge": "assets/badges/Italy-SerieA/milan.svg" },
    { "id": "atalanta", "name": "Atalanta", "badge": "assets/badges/Italy-SerieA/atalanta.svg" },
    { "id": "bologna", "name": "Bologna", "badge": "assets/badges/Italy-SerieA/bologna.svg" },
    { "id": "cagliari", "name": "Cagliari", "badge": "assets/badges/Italy-SerieA/cagliari.svg" },
    { "id": "como", "name": "Como 1907", "badge": "assets/badges/Italy-SerieA/como.svg" },
    { "id": "fiorentina", "name": "Fiorentina", "badge": "assets/badges/Italy-SerieA/fiorentina.svg" },
    { "id": "frosinone", "name": "Frosinone", "badge": "assets/badges/Italy-SerieA/frosinone.svg" },
    { "id": "genoa", "name": "Genoa", "badge": "assets/badges/Italy-SerieA/genoa.svg" },
    { "id": "inter", "name": "Inter Milan", "badge": "assets/badges/Italy-SerieA/inter.svg" },
    { "id": "juventus", "name": "Juventus", "badge": "assets/badges/Italy-SerieA/juventus.svg" },
    { "id": "lazio", "name": "SS Lazio", "badge": "assets/badges/Italy-SerieA/lazio.svg" },
    { "id": "lecce", "name": "Lecce", "badge": "assets/badges/Italy-SerieA/lecce.svg" },
    { "id": "monza", "name": "Monza", "badge": "assets/badges/Italy-SerieA/monza.svg" },
    { "id": "parma", "name": "Parma Calcio", "badge": "assets/badges/Italy-SerieA/parma.svg" },
    { "id": "roma", "name": "AS Roma", "badge": "assets/badges/Italy-SerieA/roma.svg" },
    { "id": "napoli", "name": "SSC Napoli", "badge": "assets/badges/Italy-SerieA/napoli.svg" },
    { "id": "sassuolo", "name": "Sassuolo", "badge": "assets/badges/Italy-SerieA/sassuolo.svg" },
    { "id": "torino", "name": "Torino FC", "badge": "assets/badges/Italy-SerieA/torino.svg" },
    { "id": "udinese", "name": "Udinese", "badge": "assets/badges/Italy-SerieA/udinese.svg" },
    { "id": "venezia", "name": "Venezia", "badge": "assets/badges/Italy-SerieA/venezia.svg" }
  ],
  "Spain - La Liga": [
    { "id": "alaves", "name": "Alavés", "badge": "assets/badges/Spain-LaLiga/alaves.svg" },
    { "id": "athletic", "name": "Athletic Club", "badge": "assets/badges/Spain-LaLiga/athletic.svg" },
    { "id": "atletico", "name": "Atlético Madrid", "badge": "assets/badges/Spain-LaLiga/atletico.svg" },
    { "id": "osasuna", "name": "CA Osasuna", "badge": "assets/badges/Spain-LaLiga/osasuna.svg" },
    { "id": "celta", "name": "Celta Vigo", "badge": "assets/badges/Spain-LaLiga/celta.svg" },
    { "id": "deportivo", "name": "Deportivo La Coruña", "badge": "assets/badges/Spain-LaLiga/deportivo.svg" },
    { "id": "espanyol", "name": "Espanyol", "badge": "assets/badges/Spain-LaLiga/espanyol.svg" },
    { "id": "barcelona", "name": "FC Barcelona", "badge": "assets/badges/Spain-LaLiga/barcelona.svg" },
    { "id": "getafe", "name": "Getafe CF", "badge": "assets/badges/Spain-LaLiga/getafe.svg" },
    { "id": "elche", "name": "Elche", "badge": "assets/badges/Spain-LaLiga/elche.svg" },
    { "id": "levante", "name": "Levante", "badge": "assets/badges/Spain-LaLiga/levante.svg" },
    { "id": "malaga", "name": "Malaga", "badge": "assets/badges/Spain-LaLiga/malaga.svg" },
    { "id": "racing", "name": "Racing Santander", "badge": "assets/badges/Spain-LaLiga/racing.svg" },
    { "id": "rayo", "name": "Rayo Vallecano", "badge": "assets/badges/Spain-LaLiga/rayo.svg" },
    { "id": "betis", "name": "Real Betis", "badge": "assets/badges/Spain-LaLiga/betis.svg" },
    { "id": "realmadrid", "name": "Real Madrid", "badge": "assets/badges/Spain-LaLiga/realmadrid.svg" },
    { "id": "sociedad", "name": "Real Sociedad", "badge": "assets/badges/Spain-LaLiga/sociedad.svg" },
    { "id": "sevilla", "name": "Sevilla FC", "badge": "assets/badges/Spain-LaLiga/sevilla.svg" },
    { "id": "valencia", "name": "Valencia CF", "badge": "assets/badges/Spain-LaLiga/valencia.svg" },
    { "id": "villarreal", "name": "Villarreal CF", "badge": "assets/badges/Spain-LaLiga/villarreal.svg" }
  ],
  "USA - Major League Soccer": [
    { "id": "atlanta", "name": "Atlanta United FC", "badge": "assets/badges/USA-MajorLeagueSoccer/atlanta.svg" },
    { "id": "austin", "name": "Austin FC", "badge": "assets/badges/USA-MajorLeagueSoccer/austin.svg" },
    { "id": "charlotte", "name": "Charlotte FC", "badge": "assets/badges/USA-MajorLeagueSoccer/charlotte.svg" },
    { "id": "chicagofire", "name": "Chicago Fire FC", "badge": "assets/badges/USA-MajorLeagueSoccer/chicagofire.svg" },
    { "id": "cincinnati", "name": "FC Cincinnati", "badge": "assets/badges/USA-MajorLeagueSoccer/cincinnati.svg" },
    { "id": "colorado", "name": "Colorado Rapids", "badge": "assets/badges/USA-MajorLeagueSoccer/colorado.svg" },
    { "id": "columbus", "name": "Columbus Crew", "badge": "assets/badges/USA-MajorLeagueSoccer/columbus.svg" },
    { "id": "dcunited", "name": "D.C. United", "badge": "assets/badges/USA-MajorLeagueSoccer/dcunited.svg" },
    { "id": "fcdallas", "name": "FC Dallas", "badge": "assets/badges/USA-MajorLeagueSoccer/fcdallas.svg" },
    { "id": "houston", "name": "Houston Dynamo FC", "badge": "assets/badges/USA-MajorLeagueSoccer/houston.svg" },
    { "id": "kansascity", "name": "Sporting Kansas City", "badge": "assets/badges/USA-MajorLeagueSoccer/kansascity.svg" },
    { "id": "lagalaxy", "name": "LA Galaxy", "badge": "assets/badges/USA-MajorLeagueSoccer/lagalaxy.svg" },
    { "id": "lafc", "name": "Los Angeles FC", "badge": "assets/badges/USA-MajorLeagueSoccer/lafc.svg" },
    { "id": "intermiami", "name": "Inter Miami CF", "badge": "assets/badges/USA-MajorLeagueSoccer/intermiami.svg" },
    { "id": "minnesota", "name": "Minnesota United FC", "badge": "assets/badges/USA-MajorLeagueSoccer/minnesota.svg" },
    { "id": "montreal", "name": "CF Montréal", "badge": "assets/badges/USA-MajorLeagueSoccer/montreal.svg" },
    { "id": "nashville", "name": "Nashville SC", "badge": "assets/badges/USA-MajorLeagueSoccer/nashville.svg" },
    { "id": "newengland", "name": "New England Revolution", "badge": "assets/badges/USA-MajorLeagueSoccer/newengland.svg" },
    { "id": "nycfc", "name": "New York City FC", "badge": "assets/badges/USA-MajorLeagueSoccer/nycfc.svg" },
    { "id": "nyredbulls", "name": "New York Red Bulls", "badge": "assets/badges/USA-MajorLeagueSoccer/nyredbulls.svg" },
    { "id": "orlando", "name": "Orlando City SC", "badge": "assets/badges/USA-MajorLeagueSoccer/orlando.svg" },
    { "id": "philadelphia", "name": "Philadelphia Union", "badge": "assets/badges/USA-MajorLeagueSoccer/philadelphia.svg" },
    { "id": "portland", "name": "Portland Timbers", "badge": "assets/badges/USA-MajorLeagueSoccer/portland.svg" },
    { "id": "realsaltlake", "name": "Real Salt Lake", "badge": "assets/badges/USA-MajorLeagueSoccer/realsaltlake.svg" },
    { "id": "sandiego", "name": "San Diego FC", "badge": "assets/badges/USA-MajorLeagueSoccer/sandiego.svg" },
    { "id": "sanjose", "name": "San Jose Earthquakes", "badge": "assets/badges/USA-MajorLeagueSoccer/sanjose.svg" },
    { "id": "seattle", "name": "Seattle Sounders FC", "badge": "assets/badges/USA-MajorLeagueSoccer/seattle.svg" },
    { "id": "stlouis", "name": "St. Louis City SC", "badge": "assets/badges/USA-MajorLeagueSoccer/stlouis.svg" },
    { "id": "toronto", "name": "Toronto FC", "badge": "assets/badges/USA-MajorLeagueSoccer/toronto.svg" },
    { "id": "vancouver", "name": "Vancouver Whitecaps FC", "badge": "assets/badges/USA-MajorLeagueSoccer/vancouver.svg" }
  ]
  },
  worldcup: {
  "Group A": [
    { "id": "mexico", "name": "Mexico", "badge": "assets/badges/WorldCup2026/mexico.svg" },
    { "id": "southafrica", "name": "South Africa", "badge": "assets/badges/WorldCup2026/southafrica.svg" },
    { "id": "southkorea", "name": "South Korea", "badge": "assets/badges/WorldCup2026/southkorea.svg" },
    { "id": "czechrepublic", "name": "Czech Republic", "badge": "assets/badges/WorldCup2026/czechrepublic.svg" }
  ],
  "Group B": [
    { "id": "canada", "name": "Canada", "badge": "assets/badges/WorldCup2026/canada.svg" },
    { "id": "bosnia", "name": "Bosnia and Herzegovina", "badge": "assets/badges/WorldCup2026/bosnia.svg" },
    { "id": "qatar", "name": "Qatar", "badge": "assets/badges/WorldCup2026/qatar.svg" },
    { "id": "switzerland", "name": "Switzerland", "badge": "assets/badges/WorldCup2026/switzerland.svg" }
  ],
  "Group C": [
    { "id": "brazil", "name": "Brazil", "badge": "assets/badges/WorldCup2026/brazil.svg" },
    { "id": "morocco", "name": "Morocco", "badge": "assets/badges/WorldCup2026/morocco.svg" },
    { "id": "haiti", "name": "Haiti", "badge": "assets/badges/WorldCup2026/haiti.svg" },
    { "id": "scotland", "name": "Scotland", "badge": "assets/badges/WorldCup2026/scotland.svg" }
  ],
  "Group D": [
    { "id": "usa", "name": "USA", "badge": "assets/badges/WorldCup2026/usa.svg" },
    { "id": "paraguay", "name": "Paraguay", "badge": "assets/badges/WorldCup2026/paraguay.svg" },
    { "id": "australia", "name": "Australia", "badge": "assets/badges/WorldCup2026/australia.svg" },
    { "id": "turkey", "name": "Türkiye", "badge": "assets/badges/WorldCup2026/turkey.svg" }
  ],
  "Group E": [
    { "id": "germany", "name": "Germany", "badge": "assets/badges/WorldCup2026/germany.svg" },
    { "id": "curacao", "name": "Curaçao", "badge": "assets/badges/WorldCup2026/curacao.svg" },
    { "id": "ivorycoast", "name": "Ivory Coast", "badge": "assets/badges/WorldCup2026/ivorycoast.svg" },
    { "id": "ecuador", "name": "Ecuador", "badge": "assets/badges/WorldCup2026/ecuador.svg" }
  ],
  "Group F": [
    { "id": "netherlands", "name": "Netherlands", "badge": "assets/badges/WorldCup2026/netherlands.svg" },
    { "id": "japan", "name": "Japan", "badge": "assets/badges/WorldCup2026/japan.svg" },
    { "id": "sweden", "name": "Sweden", "badge": "assets/badges/WorldCup2026/sweden.svg" },
    { "id": "tunisia", "name": "Tunisia", "badge": "assets/badges/WorldCup2026/tunisia.svg" }
  ],
  "Group G": [
    { "id": "belgium", "name": "Belgium", "badge": "assets/badges/WorldCup2026/belgium.svg" },
    { "id": "egypt", "name": "Egypt", "badge": "assets/badges/WorldCup2026/egypt.svg" },
    { "id": "iran", "name": "Iran", "badge": "assets/badges/WorldCup2026/iran.svg" },
    { "id": "newzealand", "name": "New Zealand", "badge": "assets/badges/WorldCup2026/newzealand.svg" }
  ],
  "Group H": [
    { "id": "spain", "name": "Spain", "badge": "assets/badges/WorldCup2026/spain.svg" },
    { "id": "capeverde", "name": "Cape Verde", "badge": "assets/badges/WorldCup2026/capeverde.svg" },
    { "id": "saudiarabia", "name": "Saudi Arabia", "badge": "assets/badges/WorldCup2026/saudiarabia.svg" },
    { "id": "uruguay", "name": "Uruguay", "badge": "assets/badges/WorldCup2026/uruguay.svg" }
  ],
  "Group I": [
    { "id": "france", "name": "France", "badge": "assets/badges/WorldCup2026/france.svg" },
    { "id": "senegal", "name": "Senegal", "badge": "assets/badges/WorldCup2026/senegal.svg" },
    { "id": "iraq", "name": "Iraq", "badge": "assets/badges/WorldCup2026/iraq.svg" },
    { "id": "norway", "name": "Norway", "badge": "assets/badges/WorldCup2026/norway.svg" }
  ],
  "Group J": [
    { "id": "argentina", "name": "Argentina", "badge": "assets/badges/WorldCup2026/argentina.svg" },
    { "id": "algeria", "name": "Algeria", "badge": "assets/badges/WorldCup2026/algeria.svg" },
    { "id": "austria", "name": "Austria", "badge": "assets/badges/WorldCup2026/austria.svg" },
    { "id": "jordan", "name": "Jordan", "badge": "assets/badges/WorldCup2026/jordan.svg" }
  ],
  "Group K": [
    { "id": "portugal", "name": "Portugal", "badge": "assets/badges/WorldCup2026/portugal.svg" },
    { "id": "drcongo", "name": "DR Congo", "badge": "assets/badges/WorldCup2026/drcongo.svg" },
    { "id": "uzbekistan", "name": "Uzbekistan", "badge": "assets/badges/WorldCup2026/uzbekistan.svg" },
    { "id": "colombia", "name": "Colombia", "badge": "assets/badges/WorldCup2026/colombia.svg" }
  ],
  "Group L": [
    { "id": "england", "name": "England", "badge": "assets/badges/WorldCup2026/england.svg" },
    { "id": "croatia", "name": "Croatia", "badge": "assets/badges/WorldCup2026/croatia.svg" },
    { "id": "ghana", "name": "Ghana", "badge": "assets/badges/WorldCup2026/ghana.svg" },
    { "id": "panama", "name": "Panama", "badge": "assets/badges/WorldCup2026/panama.svg" }
  ]
  }
};