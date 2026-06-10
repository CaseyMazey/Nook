
// =========================
// NATIONAL DAY — Lokale Datei-Version
// Personal HUB · Today sidebar widget
//
// Daten aus national_day.txt — vollständiges Jahr, kein API-Call,
// kein CORS-Problem, funktioniert sicher auf file:// Protokoll.
// =========================

(function() {

// =========================
// NATIONAL DAY DATA — vollständiges Jahr
// Generiert aus national_day.txt
// Format: 'MM-DD': [{title, desc}, ...]
// =========================

const NATIONAL_DAYS_DATA = {
  '01-01': [
    { title: 'Neujahr', desc: 'Beginn des neuen Kalenderjahres weltweit.' },
    { title: 'National Bloody Mary Day', desc: 'Aktionstag rund um den bekannten Cocktail.' },
    { title: 'Weltfriedenstag', desc: 'Von der UNO unterstützter Tag für Frieden.' }
  ],
  '01-02': [
    { title: 'National Science Fiction Day', desc: 'Würdigt Science-Fiction und ihre Autoren.' },
    { title: 'National Cream Puff Day', desc: 'Feiert das beliebte Brandteiggebäck.' },
    { title: 'Weltintrovertiertentag', desc: 'Macht auf die Stärken Introvertierter aufmerksam.' }
  ],
  '01-03': [
    { title: 'National Chocolate Covered Cherry Day', desc: 'Feiert Pralinen mit Kirsche und Schokolade.' },
    { title: 'National Drinking Straw Day', desc: 'Erinnerung an die Entwicklung des Trinkhalms.' },
    { title: 'J. R. R. Tolkien Day', desc: 'Gedenkt dem Autor von Der Herr der Ringe.' }
  ],
  '01-04': [
    { title: 'National Spaghetti Day', desc: 'Feiert eines der bekanntesten Nudelgerichte.' },
    { title: 'National Trivia Day', desc: 'Tag für Quizfragen und Allgemeinwissen.' },
    { title: 'Welt-Braille-Tag', desc: 'Fördert die Brailleschrift für Blinde.' }
  ],
  '01-05': [
    { title: 'National Bird Day', desc: 'Macht auf Vogelschutz aufmerksam.' },
    { title: 'National Whipped Cream Day', desc: 'Feiert Schlagsahne in Desserts und Getränken.' },
    { title: 'Twelfth Night', desc: 'Traditioneller Vorabend des Dreikönigstags.' }
  ],
  '01-06': [
    { title: 'National Shortbread Day', desc: 'Feiert das schottische Buttergebäck.' },
    { title: 'National Bean Day', desc: 'Aktionstag rund um Bohnen als Lebensmittel.' },
    { title: 'Heilige Drei Könige', desc: 'Christlicher Feiertag zur Erscheinung Jesu.' }
  ],
  '01-07': [
    { title: 'National Tempura Day', desc: 'Feiert die japanische Spezialität Tempura.' },
    { title: 'Old Rock Day', desc: 'Würdigt Gesteine und geologische Geschichte.' },
    { title: 'Orthodoxes Weihnachtsfest', desc: 'Weihnachten vieler orthodoxer Kirchen.' }
  ],
  '01-08': [
    { title: 'National Bubble Bath Day', desc: 'Feiert entspannende Schaumbäder.' },
    { title: 'Earth’s Rotation Day', desc: 'Erinnerung an die Erdrotation.' },
    { title: 'National Career Coach Day', desc: 'Würdigt Berufs- und Karriereberater.' }
  ],
  '01-09': [
    { title: 'National Apricot Day', desc: 'Feiert die Aprikose als Frucht.' },
    { title: 'National Law Enforcement Appreciation Day', desc: 'Anerkennung für Polizeikräfte.' },
    { title: 'International Choreographers Day', desc: 'Würdigt die Arbeit von Choreografen.' }
  ],
  '01-10': [
    { title: 'National Save the Eagles Day', desc: 'Macht auf den Schutz von Adlern aufmerksam.' },
    { title: 'National Bittersweet Chocolate Day', desc: 'Feiert Bitterschokolade.' },
    { title: 'National Houseplant Appreciation Day', desc: 'Würdigt Zimmerpflanzen und ihre Pflege.' }
  ],
  '01-11': [
    { title: 'National Milk Day', desc: 'Feiert die Einführung von Milch in Glasflaschen.' },
    { title: 'National Human Trafficking Awareness Day', desc: 'Sensibilisiert für Menschenhandel und Opferschutz.' },
    { title: 'Tag des Dankeschöns', desc: 'Ermutigt dazu, anderen Wertschätzung zu zeigen.' }
  ],
  '01-12': [
    { title: 'National Marzipan Day', desc: 'Feiert die beliebte Süßigkeit aus Mandeln.' },
    { title: 'National Youth Day', desc: 'Würdigt junge Menschen und ihr Potenzial.' },
    { title: 'Kiss a Ginger Day', desc: 'Aktionstag gegen Vorurteile gegenüber Rothaarigen.' }
  ],
  '01-13': [
    { title: 'National Sticker Day', desc: 'Feiert Aufkleber und kreative Gestaltung.' },
    { title: 'National Rubber Ducky Day', desc: 'Widmet sich der bekannten Badeente.' },
    { title: 'Lohri', desc: 'Nordindisches Ernte- und Winterfest.' }
  ],
  '01-14': [
    { title: 'National Dress Up Your Pet Day', desc: 'Haustiere stehen heute besonders im Mittelpunkt.' },
    { title: 'National Hot Pastrami Sandwich Day', desc: 'Feiert das klassische Pastrami-Sandwich.' },
    { title: 'Orthodoxes Neujahr', desc: 'Neujahr nach dem julianischen Kalender.' }
  ],
  '01-15': [
    { title: 'National Bagel Day', desc: 'Feiert das ringförmige Hefegebäck.' },
    { title: 'National Hat Day', desc: 'Würdigt Hüte als Mode und Schutz.' },
    { title: 'Thai Pongal', desc: 'Traditionelles tamilisches Erntedankfest.' }
  ],
  '01-16': [
    { title: 'National Nothing Day', desc: 'Ein Tag, an dem bewusst nichts gefeiert wird.' },
    { title: 'National Fig Newton Day', desc: 'Feiert das bekannte Feigengebäck.' },
    { title: 'Internationaler Tag der scharfen Küche', desc: 'Würdigt würzige Speisen weltweit.' }
  ],
  '01-17': [
    { title: 'National Bootlegger\'s Day', desc: 'Erinnerung an das Ende der US-Prohibition.' },
    { title: 'National Hot Buttered Rum Day', desc: 'Feiert das traditionelle Heißgetränk.' },
    { title: 'Ditch New Year\'s Resolutions Day', desc: 'Tag zum Hinterfragen guter Vorsätze.' }
  ],
  '01-18': [
    { title: 'National Winnie the Pooh Day', desc: 'Feiert die bekannte Kinderbuchfigur.' },
    { title: 'National Thesaurus Day', desc: 'Würdigt Nachschlagewerke für Synonyme.' },
    { title: 'Weltreligionstag', desc: 'Fördert Verständnis zwischen Religionen.' }
  ],
  '01-19': [
    { title: 'National Popcorn Day', desc: 'Feiert Popcorn als beliebten Snack.' },
    { title: 'National Tin Can Day', desc: 'Erinnerung an die Konservendose.' },
    { title: 'Martin Luther King Jr. Day', desc: 'Gedenkt dem Bürgerrechtler Martin Luther King.' }
  ],
  '01-20': [
    { title: 'National Cheese Lover\'s Day', desc: 'Feiert Käse in all seinen Varianten.' },
    { title: 'National Buttercrunch Day', desc: 'Würdigt die Süßigkeit Buttercrunch.' },
    { title: 'Tag der Pinguin-Bewusstseinsbildung', desc: 'Macht auf den Schutz von Pinguinen aufmerksam.' }
  ],
  '01-21': [
    { title: 'National Hugging Day', desc: 'Ermutigt dazu, Umarmungen zu schenken.' },
    { title: 'National Granola Bar Day', desc: 'Feiert Müsliriegel als beliebten Snack.' },
    { title: 'Weltknuddeltag', desc: 'Aktionstag für Nähe und Verbundenheit.' }
  ],
  '01-22': [
    { title: 'National Blonde Brownie Day', desc: 'Feiert Blondies, die helle Variante des Brownies.' },
    { title: 'Celebration of Life Day', desc: 'Regt dazu an, das Leben bewusst zu würdigen.' },
    { title: 'Chinesisches Neujahrsvorfest', desc: 'Vorbereitungen auf das Frühlingsfest in vielen Regionen.' }
  ],
  '01-23': [
    { title: 'National Pie Day', desc: 'Feiert Kuchen und Torten in vielen Variationen.' },
    { title: 'National Handwriting Day', desc: 'Würdigt die Handschrift im digitalen Zeitalter.' },
    { title: 'Tag der Handschrift', desc: 'Fördert kreatives und persönliches Schreiben.' }
  ],
  '01-24': [
    { title: 'National Peanut Butter Day', desc: 'Feiert Erdnussbutter als vielseitigen Brotaufstrich.' },
    { title: 'National Compliment Day', desc: 'Ermutigt dazu, ehrliche Komplimente zu machen.' },
    { title: 'Internationaler Tag der Bildung', desc: 'UNO-Tag zur Bedeutung von Bildung für alle.' }
  ],
  '01-25': [
    { title: 'National Irish Coffee Day', desc: 'Feiert das Getränk aus Kaffee und Sahne.' },
    { title: 'National Opposite Day', desc: 'Spielerischer Tag für Gegensätze.' },
    { title: 'Burns Night', desc: 'Gedenkt dem schottischen Dichter Robert Burns.' }
  ],
  '01-26': [
    { title: 'National Green Juice Day', desc: 'Fördert den Genuss von Obst- und Gemüsesäften.' },
    { title: 'National Peanut Brittle Day', desc: 'Feiert die Süßigkeit aus Erdnüssen und Zucker.' },
    { title: 'Internationaler Tag des Zolls', desc: 'Würdigt die Arbeit von Zollbehörden weltweit.' }
  ],
  '01-27': [
    { title: 'National Chocolate Cake Day', desc: 'Feiert Schokoladenkuchen in allen Varianten.' },
    { title: 'National Geographic Day', desc: 'Würdigt geografisches Wissen und Entdeckungen.' },
    { title: 'Internationaler Holocaust-Gedenktag', desc: 'Gedenkt der Opfer des Nationalsozialismus.' }
  ],
  '01-28': [
    { title: 'National Blueberry Pancake Day', desc: 'Feiert Pfannkuchen mit Heidelbeeren.' },
    { title: 'National Kazoo Day', desc: 'Würdigt das einfache Musikinstrument Kazoo.' },
    { title: 'Europäischer Datenschutztag', desc: 'Fördert den Schutz persönlicher Daten.' }
  ],
  '01-29': [
    { title: 'National Puzzle Day', desc: 'Feiert Puzzles und Denkspiele.' },
    { title: 'National Corn Chip Day', desc: 'Würdigt Maischips als Snack.' },
    { title: 'Tag der Freidenker', desc: 'Fördert kritisches und unabhängiges Denken.' }
  ],
  '01-30': [
    { title: 'National Croissant Day', desc: 'Feiert das bekannte französische Gebäck.' },
    { title: 'National Escape Day', desc: 'Ermutigt zu einer kleinen Auszeit vom Alltag.' },
    { title: 'Welttag der vernachlässigten Tropenkrankheiten', desc: 'UNO-Tag zur Bekämpfung seltener Krankheiten.' }
  ],
  '01-31': [
    { title: 'National Hot Chocolate Day', desc: 'Feiert heiße Schokolade an kalten Tagen.' },
    { title: 'National Backward Day', desc: 'Spielerischer Aktionstag für ungewöhnte Abläufe.' },
    { title: 'Internationaler Tag des Zebras', desc: 'Macht auf den Schutz von Zebras aufmerksam.' }
  ],
  '02-01': [
    { title: 'National Dark Chocolate Day', desc: 'Feiert dunkle Schokolade in ihren vielen Varianten.' },
    { title: 'National Freedom Day', desc: 'Erinnert an die Abschaffung der Sklaverei in den USA.' },
    { title: 'Weltinterreligiöse Harmonie-Woche', desc: 'Fördert den Dialog zwischen Religionen.' }
  ],
  '02-02': [
    { title: 'National Groundhog Day', desc: 'Traditionstag rund um die Wettervorhersage des Murmeltiers.' },
    { title: 'National Ukulele Day', desc: 'Feiert das beliebte Saiteninstrument.' },
    { title: 'Welttag der Feuchtgebiete', desc: 'Macht auf den Schutz von Feuchtgebieten aufmerksam.' }
  ],
  '02-03': [
    { title: 'National Carrot Cake Day', desc: 'Feiert Karottenkuchen als beliebtes Gebäck.' },
    { title: 'National Women Physicians Day', desc: 'Würdigt Frauen in der Medizin.' },
    { title: 'Four Chaplains Day', desc: 'Gedenkt vier Militärseelsorgern des Zweiten Weltkriegs.' }
  ],
  '02-04': [
    { title: 'National Homemade Soup Day', desc: 'Feiert selbstgemachte Suppen.' },
    { title: 'National Thank A Mail Carrier Day', desc: 'Dankt Zustellern für ihre Arbeit.' },
    { title: 'Weltkrebstag', desc: 'Fördert Prävention, Forschung und Aufklärung zu Krebs.' }
  ],
  '02-05': [
    { title: 'National Weatherperson\'s Day', desc: 'Würdigt Meteorologen und Wetterdienste.' },
    { title: 'National Chocolate Fondue Day', desc: 'Feiert Schokoladenfondue.' },
    { title: 'Welt-Nutella-Tag', desc: 'Feiert den beliebten Haselnussaufstrich.' }
  ],
  '02-06': [
    { title: 'National Chopsticks Day', desc: 'Feiert Essstäbchen und ihre Kultur.' },
    { title: 'National Frozen Yogurt Day', desc: 'Feiert Frozen Yogurt als Dessert.' },
    { title: 'Internationaler Tag gegen weibliche Genitalverstümmelung', desc: 'UNO-Tag gegen diese Menschenrechtsverletzung.' }
  ],
  '02-07': [
    { title: 'National Send a Card to a Friend Day', desc: 'Ermutigt zum Versenden persönlicher Karten.' },
    { title: 'National Fettuccine Alfredo Day', desc: 'Feiert das bekannte Pastagericht.' },
    { title: 'Rosen-Tag', desc: 'Traditioneller Tag der Valentinswoche.' }
  ],
  '02-08': [
    { title: 'National Kite Flying Day', desc: 'Feiert das Drachensteigen.' },
    { title: 'National Boy Scouts Day', desc: 'Würdigt die Pfadfinderbewegung.' },
    { title: 'Safer Internet Day', desc: 'Fördert Sicherheit und Verantwortung im Internet.' }
  ],
  '02-09': [
    { title: 'National Pizza Day', desc: 'Feiert Pizza in all ihren Variationen.' },
    { title: 'National Toothache Day', desc: 'Erinnerung an die Bedeutung der Zahngesundheit.' },
    { title: 'Welttag der Ehe', desc: 'Würdigt Partnerschaft und Ehe.' }
  ],
  '02-10': [
    { title: 'National Flannel Day', desc: 'Feiert Flanellkleidung und ihren Komfort.' },
    { title: 'National Umbrella Day', desc: 'Würdigt Regenschirme als Alltagshelfer.' },
    { title: 'Welt-Hülsenfrüchtetag', desc: 'UNO-Tag zur Bedeutung von Hülsenfrüchten.' }
  ],
  '02-11': [
    { title: 'National Make a Friend Day', desc: 'Ermutigt dazu, neue Freundschaften zu schließen.' },
    { title: 'National Inventors Day', desc: 'Würdigt Erfinder und ihre Innovationen.' },
    { title: 'Internationaler Tag der Frauen und Mädchen in der Wissenschaft', desc: 'Fördert Gleichberechtigung in Forschung und Technik.' }
  ],
  '02-12': [
    { title: 'National Plum Pudding Day', desc: 'Feiert den traditionellen Pflaumenpudding.' },
    { title: 'National Lost Penny Day', desc: 'Erinnerung daran, kleine Dinge wertzuschätzen.' },
    { title: 'Roter-Hand-Tag', desc: 'Aktionstag gegen den Einsatz von Kindersoldaten.' }
  ],
  '02-13': [
    { title: 'National Cheddar Day', desc: 'Feiert den bekannten Cheddar-Käse.' },
    { title: 'National Tortellini Day', desc: 'Würdigt die italienische Pastaspezialität.' },
    { title: 'Welttag des Radios', desc: 'Hebt die Bedeutung des Radios hervor.' }
  ],
  '02-14': [
    { title: 'National Cream-Filled Chocolates Day', desc: 'Feiert gefüllte Schokoladenpralinen.' },
    { title: 'National Ferris Wheel Day', desc: 'Würdigt das Riesenrad als Attraktion.' },
    { title: 'Valentinstag', desc: 'Tag der Liebe und Zuneigung.' }
  ],
  '02-15': [
    { title: 'National Gumdrop Day', desc: 'Feiert die bunten Fruchtgummis.' },
    { title: 'National Wisconsin Day', desc: 'Würdigt den US-Bundesstaat Wisconsin.' },
    { title: 'International Childhood Cancer Day', desc: 'Macht auf Krebs bei Kindern aufmerksam.' }
  ],
  '02-16': [
    { title: 'National Almond Day', desc: 'Feiert die Mandel als vielseitige Zutat.' },
    { title: 'National Do a Grouch a Favor Day', desc: 'Ermutigt zu Freundlichkeit gegenüber anderen.' },
    { title: 'Tag der Innovation', desc: 'Würdigt kreative Ideen und Entwicklungen.' }
  ],
  '02-17': [
    { title: 'National Random Acts of Kindness Day', desc: 'Fördert spontane freundliche Gesten.' },
    { title: 'National Cabbage Day', desc: 'Feiert Kohl als gesundes Gemüse.' },
    { title: 'Welttag der menschlichen Solidarität', desc: 'Stärkt Zusammenhalt und gegenseitige Hilfe.' }
  ],
  '02-18': [
    { title: 'National Drink Wine Day', desc: 'Feiert die Kultur des Weins.' },
    { title: 'National Battery Day', desc: 'Würdigt Batterien und Energiespeicherung.' },
    { title: 'Pluto-Entdeckungstag', desc: 'Erinnerung an die Entdeckung des Zwergplaneten.' }
  ],
  '02-19': [
    { title: 'National Chocolate Mint Day', desc: 'Feiert die Kombination aus Schokolade und Minze.' },
    { title: 'National Lash Day', desc: 'Würdigt Wimpern und Augenpflege.' },
    { title: 'Welttag der Wale', desc: 'Macht auf den Schutz von Walen aufmerksam.' }
  ],
  '02-20': [
    { title: 'National Cherry Pie Day', desc: 'Feiert Kirschkuchen als Klassiker.' },
    { title: 'National Love Your Pet Day', desc: 'Würdigt Haustiere und ihre Bedeutung.' },
    { title: 'Welttag der sozialen Gerechtigkeit', desc: 'UNO-Tag für Chancengleichheit und Menschenrechte.' }
  ],
  '02-21': [
    { title: 'National Sticky Bun Day', desc: 'Feiert süße Hefeschnecken mit Glasur.' },
    { title: 'National Grain-Free Day', desc: 'Macht auf getreidefreie Ernährung aufmerksam.' },
    { title: 'Internationaler Tag der Muttersprache', desc: 'Fördert sprachliche Vielfalt und Mehrsprachigkeit.' }
  ],
  '02-22': [
    { title: 'National Cook a Sweet Potato Day', desc: 'Feiert die Süßkartoffel in der Küche.' },
    { title: 'National Margarita Day', desc: 'Würdigt den bekannten Cocktail.' },
    { title: 'Weltdenken-Tag', desc: 'Pfadfinderischer Aktionstag für internationale Freundschaft.' }
  ],
  '02-23': [
    { title: 'National Banana Bread Day', desc: 'Feiert Bananenbrot als beliebtes Gebäck.' },
    { title: 'National Dog Biscuit Day', desc: 'Würdigt Leckerlis für Hunde.' },
    { title: 'Internationaler Tag des Hundekekses', desc: 'Macht auf das Wohl von Haustieren aufmerksam.' }
  ],
  '02-24': [
    { title: 'National Tortilla Chip Day', desc: 'Feiert Tortilla-Chips als beliebten Snack.' },
    { title: 'National Trading Card Day', desc: 'Würdigt Sammelkarten und ihre Geschichte.' },
    { title: 'Weltbartag', desc: 'Feiert Bärte als kulturelles Symbol.' }
  ],
  '02-25': [
    { title: 'National Chocolate Covered Nut Day', desc: 'Feiert Nüsse mit Schokoladenüberzug.' },
    { title: 'National Clam Chowder Day', desc: 'Würdigt die traditionelle Muschelsuppe.' },
    { title: 'Kuwait National Day', desc: 'Nationalfeiertag des Staates Kuwait.' }
  ],
  '02-26': [
    { title: 'National Pistachio Day', desc: 'Feiert die Pistazie als Snack und Zutat.' },
    { title: 'National Tell a Fairy Tale Day', desc: 'Ermutigt zum Erzählen von Märchen.' },
    { title: 'Tag des Geschichtenerzählens', desc: 'Würdigt die Kunst des Erzählens.' }
  ],
  '02-27': [
    { title: 'National Strawberry Day', desc: 'Feiert Erdbeeren und ihre Vielseitigkeit.' },
    { title: 'National Polar Bear Day', desc: 'Macht auf den Schutz der Eisbären aufmerksam.' },
    { title: 'Welt-Eisbärentag', desc: 'Sensibilisiert für die Folgen des Klimawandels.' }
  ],
  '02-28': [
    { title: 'National Chocolate Soufflé Day', desc: 'Feiert das luftige Schokoladendessert.' },
    { title: 'National Tooth Fairy Day', desc: 'Würdigt die Zahnfee als Kindertradition.' },
    { title: 'Tag der seltenen Erkrankungen', desc: 'Macht auf Menschen mit seltenen Krankheiten aufmerksam.' }
  ],
  '03-01': [
    { title: 'National Peanut Butter Lover\'s Day', desc: 'Feiert Erdnussbutter und ihre Fans.' },
    { title: 'National Pig Day', desc: 'Würdigt Schweine und ihren Beitrag zur Landwirtschaft.' },
    { title: 'Zero Discrimination Day', desc: 'UNO-Tag gegen Diskriminierung weltweit.' }
  ],
  '03-02': [
    { title: 'National Banana Cream Pie Day', desc: 'Feiert die Bananencremetorte.' },
    { title: 'National Old Stuff Day', desc: 'Ermutigt dazu, alte Dinge neu zu entdecken.' },
    { title: 'Tag des Lesens in Amerika', desc: 'Fördert Freude am Lesen und an Büchern.' }
  ],
  '03-03': [
    { title: 'National Cold Cuts Day', desc: 'Feiert Aufschnitt und Wurstspezialitäten.' },
    { title: 'National Anthem Day', desc: 'Würdigt Nationalhymnen und ihre Geschichte.' },
    { title: 'Welttag des Artenschutzes', desc: 'UNO-Tag zum Schutz bedrohter Tier- und Pflanzenarten.' }
  ],
  '03-04': [
    { title: 'National Grammar Day', desc: 'Fördert korrekte Sprache und Grammatik.' },
    { title: 'National Pound Cake Day', desc: 'Feiert den traditionellen Rührkuchen.' },
    { title: 'Welttag gegen Adipositas', desc: 'Macht auf Übergewicht und Prävention aufmerksam.' }
  ],
  '03-05': [
    { title: 'National Cheese Doodle Day', desc: 'Feiert den beliebten Käsesnack.' },
    { title: 'National Absinthe Day', desc: 'Würdigt die Geschichte des Absinths.' },
    { title: 'Internationaler Tag der Energieeffizienz', desc: 'Fördert einen bewussten Umgang mit Energie.' }
  ],
  '03-06': [
    { title: 'National Oreo Cookie Day', desc: 'Feiert den bekannten Doppelkeks.' },
    { title: 'National Dress Day', desc: 'Würdigt Kleider als Teil der Mode.' },
    { title: 'Europäischer Tag der Logopädie', desc: 'Macht auf Sprachtherapie aufmerksam.' }
  ],
  '03-07': [
    { title: 'National Cereal Day', desc: 'Feiert Frühstücksflocken in vielen Varianten.' },
    { title: 'National Crown Roast of Pork Day', desc: 'Würdigt das traditionelle Schweinegericht.' },
    { title: 'Tag der Namensforschung', desc: 'Beschäftigt sich mit Herkunft und Bedeutung von Namen.' }
  ],
  '03-08': [
    { title: 'National Proofreading Day', desc: 'Fördert sorgfältiges Korrekturlesen.' },
    { title: 'National Peanut Cluster Day', desc: 'Feiert Erdnuss-Schokoladen-Snacks.' },
    { title: 'Internationaler Frauentag', desc: 'Würdigt die Rechte und Leistungen von Frauen.' }
  ],
  '03-09': [
    { title: 'National Meatball Day', desc: 'Feiert Fleischbällchen in verschiedenen Küchen.' },
    { title: 'National Barbie Day', desc: 'Würdigt die berühmte Modepuppe.' },
    { title: 'Tag der Panikfreiheit', desc: 'Ermutigt zu Gelassenheit im Alltag.' }
  ],
  '03-10': [
    { title: 'National Pack Your Lunch Day', desc: 'Regt dazu an, das Mittagessen selbst mitzunehmen.' },
    { title: 'National Blueberry Popover Day', desc: 'Feiert das luftige Gebäck mit Heidelbeeren.' },
    { title: 'Mario Day', desc: 'Feiert die bekannte Videospielfigur Mario.' }
  ],
  '03-11': [
    { title: 'National Johnny Appleseed Day', desc: 'Würdigt den US-Pionier und Apfelpflanzer.' },
    { title: 'National Worship of Tools Day', desc: 'Feiert Werkzeuge und handwerkliches Können.' },
    { title: 'World Plumbing Day', desc: 'Macht auf die Bedeutung sanitärer Versorgung aufmerksam.' }
  ],
  '03-12': [
    { title: 'National Baked Scallops Day', desc: 'Feiert überbackene Jakobsmuscheln.' },
    { title: 'National Plant a Flower Day', desc: 'Ermutigt zum Pflanzen von Blumen.' },
    { title: 'Welttag gegen Internetzensur', desc: 'Setzt sich für freie Meinungsäußerung ein.' }
  ],
  '03-13': [
    { title: 'National Good Samaritan Day', desc: 'Würdigt Hilfsbereitschaft gegenüber anderen.' },
    { title: 'National Jewel Day', desc: 'Feiert Schmuck und Edelsteine.' },
    { title: 'Internationaler Tag des Schlafes', desc: 'Macht auf gesunden Schlaf aufmerksam.' }
  ],
  '03-14': [
    { title: 'National Potato Chip Day', desc: 'Feiert Kartoffelchips als beliebten Snack.' },
    { title: 'National Write Your Story Day', desc: 'Ermutigt dazu, die eigene Geschichte aufzuschreiben.' },
    { title: 'Pi-Tag', desc: 'Feiert die Kreiszahl Pi und Mathematik.' }
  ],
  '03-15': [
    { title: 'National Pears Helene Day', desc: 'Feiert das Dessert Birne Helene.' },
    { title: 'National Everything You Think Is Wrong Day', desc: 'Regt dazu an, eigene Ansichten zu hinterfragen.' },
    { title: 'Weltverbrauchertag', desc: 'Stärkt die Rechte von Verbraucherinnen und Verbrauchern.' }
  ],
  '03-16': [
    { title: 'National Artichoke Day', desc: 'Feiert die Artischocke als Delikatesse.' },
    { title: 'National Panda Day', desc: 'Macht auf den Schutz von Pandas aufmerksam.' },
    { title: 'Tag der Vielfalt', desc: 'Würdigt unterschiedliche Kulturen und Lebensweisen.' }
  ],
  '03-17': [
    { title: 'National Corned Beef and Cabbage Day', desc: 'Feiert das traditionelle Gericht zum St. Patrick\'s Day.' },
    { title: 'National Submarine Day', desc: 'Würdigt die Geschichte von U-Booten.' },
    { title: 'St. Patrick\'s Day', desc: 'Feiert die irische Kultur und Tradition.' }
  ],
  '03-18': [
    { title: 'National Sloppy Joe Day', desc: 'Feiert das bekannte Hackfleisch-Sandwich.' },
    { title: 'National Biodiesel Day', desc: 'Würdigt erneuerbare Kraftstoffe.' },
    { title: 'Global Recycling Day', desc: 'Fördert Recycling und Ressourcenschutz.' }
  ],
  '03-19': [
    { title: 'National Chocolate Caramel Day', desc: 'Feiert die Kombination aus Schokolade und Karamell.' },
    { title: 'National Let\'s Laugh Day', desc: 'Ermutigt zu mehr Lachen im Alltag.' },
    { title: 'Josefstag', desc: 'Christlicher Gedenktag zu Ehren des heiligen Josef.' }
  ],
  '03-20': [
    { title: 'National Ravioli Day', desc: 'Feiert die gefüllte italienische Pasta.' },
    { title: 'National Proposal Day', desc: 'Tag für Heiratsanträge und Liebesbekundungen.' },
    { title: 'Internationaler Tag des Glücks', desc: 'UNO-Tag zur Förderung von Wohlbefinden und Zufriedenheit.' }
  ],
  '03-21': [
    { title: 'National French Bread Day', desc: 'Feiert das klassische französische Brot.' },
    { title: 'National Single Parent Day', desc: 'Würdigt die Leistung Alleinerziehender.' },
    { title: 'Internationaler Tag gegen Rassismus', desc: 'Setzt ein Zeichen für Gleichberechtigung und Respekt.' }
  ],
  '03-22': [
    { title: 'National Bavarian Crepes Day', desc: 'Feiert die bayerische Variante von Pfannkuchen.' },
    { title: 'National Goof Off Day', desc: 'Ermutigt zu einer kleinen Pause vom Alltag.' },
    { title: 'Weltwassertag', desc: 'UNO-Tag zum Schutz der Wasserressourcen.' }
  ],
  '03-23': [
    { title: 'National Chip and Dip Day', desc: 'Feiert Chips mit verschiedenen Dips.' },
    { title: 'National Puppy Day', desc: 'Würdigt Welpen und verantwortungsvolle Tierhaltung.' },
    { title: 'Welttag der Meteorologie', desc: 'Macht auf Wetter- und Klimaforschung aufmerksam.' }
  ],
  '03-24': [
    { title: 'National Cheesesteak Day', desc: 'Feiert das berühmte Sandwich aus Philadelphia.' },
    { title: 'National Cocktail Day', desc: 'Würdigt die Vielfalt von Cocktails.' },
    { title: 'Welt-Tuberkulose-Tag', desc: 'Informiert über Prävention und Behandlung von Tuberkulose.' }
  ],
  '03-25': [
    { title: 'National Medal of Honor Day', desc: 'Ehrt Träger der höchsten US-Militärauszeichnung.' },
    { title: 'National Tolkien Reading Day', desc: 'Ermutigt zum Lesen der Werke Tolkiens.' },
    { title: 'Internationaler Tag des Gedenkens an die Opfer der Sklaverei', desc: 'UNO-Gedenktag für die Opfer des Sklavenhandels.' }
  ],
  '03-26': [
    { title: 'National Spinach Day', desc: 'Feiert Spinat als gesundes Gemüse.' },
    { title: 'National Nougat Day', desc: 'Würdigt die Süßigkeit Nougat.' },
    { title: 'Purple Day', desc: 'Aktionstag zur Aufklärung über Epilepsie.' }
  ],
  '03-27': [
    { title: 'National Joe Day', desc: 'Feiert Menschen mit dem Namen Joe.' },
    { title: 'National Scribble Day', desc: 'Ermutigt zu kreativem Zeichnen und Kritzeln.' },
    { title: 'Welttheatertag', desc: 'Würdigt Theaterkunst und Bühnenkultur.' }
  ],
  '03-28': [
    { title: 'National Black Forest Cake Day', desc: 'Feiert die Schwarzwälder Kirschtorte.' },
    { title: 'National Something on a Stick Day', desc: 'Feiert Speisen am Spieß.' },
    { title: 'Earth Hour Day', desc: 'Aktion für Klima- und Umweltschutz.' }
  ],
  '03-29': [
    { title: 'National Mom and Pop Business Owners Day', desc: 'Würdigt kleine familiengeführte Unternehmen.' },
    { title: 'National Lemon Chiffon Cake Day', desc: 'Feiert den luftigen Zitronenkuchen.' },
    { title: 'Klaviertag', desc: 'Feiert das Klavier und seine Musik.' }
  ],
  '03-30': [
    { title: 'National Pencil Day', desc: 'Würdigt den Bleistift als Schreibwerkzeug.' },
    { title: 'National Doctors Day', desc: 'Dankt Ärztinnen und Ärzten für ihre Arbeit.' },
    { title: 'Internationaler Tag der Hausangestellten', desc: 'Macht auf die Rechte von Hausangestellten aufmerksam.' }
  ],
  '03-31': [
    { title: 'National Tater Day', desc: 'Feiert Kartoffeln in vielen Zubereitungen.' },
    { title: 'National Crayon Day', desc: 'Würdigt Buntstifte und kreative Kunst.' },
    { title: 'Internationaler Tag der Sichtbarkeit von Transgender-Personen', desc: 'Fördert Akzeptanz und gesellschaftliche Teilhabe.' }
  ],
  '04-01': [
    { title: 'National Sourdough Bread Day', desc: 'Feiert Sauerteigbrot und traditionelle Backkunst.' },
    { title: 'National One Cent Day', desc: 'Würdigt die Ein-Cent-Münze und ihre Geschichte.' },
    { title: 'Aprilscherztag', desc: 'Tag für harmlose Streiche und Scherze.' }
  ],
  '04-02': [
    { title: 'National Peanut Butter and Jelly Day', desc: 'Feiert die beliebte Kombination aus Erdnussbutter und Marmelade.' },
    { title: 'National Reconciliation Day', desc: 'Fördert Versöhnung und gegenseitiges Verständnis.' },
    { title: 'Welt-Autismus-Tag', desc: 'UNO-Tag für Akzeptanz und Unterstützung autistischer Menschen.' }
  ],
  '04-03': [
    { title: 'National Chocolate Mousse Day', desc: 'Feiert das luftige Schokoladendessert.' },
    { title: 'National Find a Rainbow Day', desc: 'Ermutigt dazu, nach Regenbögen Ausschau zu halten.' },
    { title: 'Weltparteitag', desc: 'Aktionstag für politische Teilhabe und Demokratie.' }
  ],
  '04-04': [
    { title: 'National Cordon Bleu Day', desc: 'Feiert das bekannte Schnitzelgericht.' },
    { title: 'National Hug a Newsperson Day', desc: 'Würdigt Journalistinnen und Journalisten.' },
    { title: 'Internationaler Tag der Minenaufklärung', desc: 'UNO-Tag gegen Landminen und explosive Altlasten.' }
  ],
  '04-05': [
    { title: 'National Caramel Day', desc: 'Feiert Karamell in all seinen Varianten.' },
    { title: 'National Deep Dish Pizza Day', desc: 'Würdigt die berühmte Chicago-Pizza.' },
    { title: 'Internationaler Tag des Gewissens', desc: 'Fördert Mitgefühl und verantwortungsvolles Handeln.' }
  ],
  '04-06': [
    { title: 'National Caramel Popcorn Day', desc: 'Feiert Popcorn mit Karamellüberzug.' },
    { title: 'National Tartan Day', desc: 'Würdigt das schottische Kulturerbe.' },
    { title: 'Internationaler Tag des Sports für Entwicklung und Frieden', desc: 'UNO-Tag zur positiven Kraft des Sports.' }
  ],
  '04-07': [
    { title: 'National Beer Day', desc: 'Feiert die Aufhebung der US-Bierverbote.' },
    { title: 'National Coffee Cake Day', desc: 'Würdigt den klassischen Kaffeekuchen.' },
    { title: 'Weltgesundheitstag', desc: 'UNO-Tag zur Förderung der globalen Gesundheit.' }
  ],
  '04-08': [
    { title: 'National Empanada Day', desc: 'Feiert die gefüllte Teigtasche.' },
    { title: 'National All Is Ours Day', desc: 'Ermutigt zu Dankbarkeit für das Erreichte.' },
    { title: 'Internationaler Roma-Tag', desc: 'Würdigt Kultur und Geschichte der Roma.' }
  ],
  '04-09': [
    { title: 'National Chinese Almond Cookie Day', desc: 'Feiert das traditionelle Mandelgebäck.' },
    { title: 'National Unicorn Day', desc: 'Feiert das Einhorn als Fantasiewesen.' },
    { title: 'Tag der Erinnerung an die Opfer des Völkermords in Ruanda', desc: 'UNO-Gedenktag für die Opfer von 1994.' }
  ],
  '04-10': [
    { title: 'National Cinnamon Crescent Day', desc: 'Feiert süßes Hefegebäck mit Zimt.' },
    { title: 'National Siblings Day', desc: 'Würdigt die Beziehung zwischen Geschwistern.' },
    { title: 'Tag der Geschwister', desc: 'Feiert familiären Zusammenhalt.' }
  ],
  '04-11': [
    { title: 'National Pet Day', desc: 'Würdigt Haustiere und ihre Bedeutung für Menschen.' },
    { title: 'National Cheese Fondue Day', desc: 'Feiert das traditionelle Käsefondue.' },
    { title: 'Welt-Parkinson-Tag', desc: 'Macht auf Parkinson und Betroffene aufmerksam.' }
  ],
  '04-12': [
    { title: 'National Grilled Cheese Sandwich Day', desc: 'Feiert das beliebte Käse-Sandwich.' },
    { title: 'National Licorice Day', desc: 'Würdigt Lakritz in seinen vielen Formen.' },
    { title: 'Internationaler Tag der bemannten Raumfahrt', desc: 'Erinnert an den ersten Menschen im All.' }
  ],
  '04-13': [
    { title: 'National Peach Cobbler Day', desc: 'Feiert das traditionelle Pfirsichdessert.' },
    { title: 'National Scrabble Day', desc: 'Würdigt das bekannte Wortspiel.' },
    { title: 'Internationaler Tag des Kusses', desc: 'Feiert Zuneigung und zwischenmenschliche Nähe.' }
  ],
  '04-14': [
    { title: 'National Gardening Day', desc: 'Ermutigt zur Gartenarbeit und Pflanzenpflege.' },
    { title: 'National Pecan Day', desc: 'Feiert die Pekannuss als vielseitige Zutat.' },
    { title: 'Welt-Chagas-Tag', desc: 'Macht auf die Chagas-Krankheit aufmerksam.' }
  ],
  '04-15': [
    { title: 'National Glazed Spiral Ham Day', desc: 'Feiert den glasierten Schinken.' },
    { title: 'National Laundry Day', desc: 'Erinnerung an Hausarbeit und Wäschepflege.' },
    { title: 'Welttag der Kunst', desc: 'Würdigt Kunst und kreatives Schaffen.' }
  ],
  '04-16': [
    { title: 'National Eggs Benedict Day', desc: 'Feiert das bekannte Frühstücksgericht.' },
    { title: 'National Wear Your Pajamas to Work Day', desc: 'Spielerischer Aktionstag rund um Schlafkleidung.' },
    { title: 'Weltstimme-Tag', desc: 'Macht auf die Bedeutung der Stimme aufmerksam.' }
  ],
  '04-17': [
    { title: 'National Cheeseball Day', desc: 'Feiert Käsebällchen als Snack.' },
    { title: 'National Crawfish Day', desc: 'Würdigt Flusskrebse in der Küche.' },
    { title: 'Internationaler Tag des bäuerlichen Widerstands', desc: 'Macht auf die Anliegen von Kleinbauern aufmerksam.' }
  ],
  '04-18': [
    { title: 'National Animal Crackers Day', desc: 'Feiert die bekannten Tierkekse.' },
    { title: 'National Lineman Appreciation Day', desc: 'Würdigt Beschäftigte im Stromnetz.' },
    { title: 'Internationaler Denkmaltag', desc: 'Fördert den Schutz von Kulturdenkmälern.' }
  ],
  '04-19': [
    { title: 'National Garlic Day', desc: 'Feiert Knoblauch als beliebte Zutat.' },
    { title: 'National Amaretto Day', desc: 'Würdigt den italienischen Mandellikör.' },
    { title: 'Fahrradtag', desc: 'Erinnert an die erste LSD-Fahrradfahrt von Albert Hofmann.' }
  ],
  '04-20': [
    { title: 'National Cheddar Fries Day', desc: 'Feiert Pommes mit Cheddar-Käse.' },
    { title: 'National Look-Alike Day', desc: 'Spielerischer Tag rund um Doppelgänger.' },
    { title: 'Chinesischer Tag der Sprache', desc: 'UNO-Tag zur Förderung der chinesischen Sprache.' }
  ],
  '04-21': [
    { title: 'National Tea Day', desc: 'Feiert Tee und seine lange Kulturgeschichte.' },
    { title: 'National Kindergarten Day', desc: 'Würdigt Kindergärten und frühkindliche Bildung.' },
    { title: 'Weltkreativitäts- und Innovationstag', desc: 'UNO-Tag für Kreativität und neue Ideen.' }
  ],
  '04-22': [
    { title: 'National Jelly Bean Day', desc: 'Feiert die bunten Geleebohnen.' },
    { title: 'National Girl Scout Leader Day', desc: 'Würdigt Leiterinnen der Pfadfinderbewegung.' },
    { title: 'Tag der Erde', desc: 'Internationaler Aktionstag für Umwelt- und Klimaschutz.' }
  ],
  '04-23': [
    { title: 'National Picnic Day', desc: 'Ermutigt zu einem Picknick im Freien.' },
    { title: 'National Cherry Cheesecake Day', desc: 'Feiert Kirsch-Käsekuchen als Dessert.' },
    { title: 'Welttag des Buches und des Urheberrechts', desc: 'Fördert Lesen, Bücher und Kreativität.' }
  ],
  '04-24': [
    { title: 'National Pigs in a Blanket Day', desc: 'Feiert Würstchen im Teigmantel.' },
    { title: 'National Arbor Day', desc: 'Würdigt Bäume und Aufforstung.' },
    { title: 'Internationaler Tag des Multilateralismus und der Diplomatie', desc: 'UNO-Tag für internationale Zusammenarbeit.' }
  ],
  '04-25': [
    { title: 'National Telephone Day', desc: 'Feiert das Telefon und seine Entwicklung.' },
    { title: 'National Zucchini Bread Day', desc: 'Würdigt Zucchinibrot als Gebäck.' },
    { title: 'Weltmalariatag', desc: 'Informiert über Prävention und Bekämpfung von Malaria.' }
  ],
  '04-26': [
    { title: 'National Pretzel Day', desc: 'Feiert die Brezel als traditionelles Gebäck.' },
    { title: 'National Help a Horse Day', desc: 'Macht auf den Schutz von Pferden aufmerksam.' },
    { title: 'Welttag des geistigen Eigentums', desc: 'Würdigt Erfindungen, Kunst und Innovationen.' }
  ],
  '04-27': [
    { title: 'National Prime Rib Day', desc: 'Feiert das traditionelle Rindfleischgericht.' },
    { title: 'National Tell a Story Day', desc: 'Ermutigt zum Erzählen von Geschichten.' },
    { title: 'Welttag des Designs', desc: 'Würdigt gutes Design und kreative Gestaltung.' }
  ],
  '04-28': [
    { title: 'National Blueberry Pie Day', desc: 'Feiert Heidelbeerkuchen als Dessert.' },
    { title: 'National Superhero Day', desc: 'Würdigt Superhelden aus Comics und Filmen.' },
    { title: 'Welttag für Sicherheit und Gesundheit am Arbeitsplatz', desc: 'Fördert sichere Arbeitsbedingungen.' }
  ],
  '04-29': [
    { title: 'National Shrimp Scampi Day', desc: 'Feiert Garnelen in Knoblauchbutter.' },
    { title: 'National Peace Rose Day', desc: 'Würdigt die bekannte Rosensorte.' },
    { title: 'Internationaler Tag des Tanzes', desc: 'Feiert Tanz als Kunstform und Ausdrucksmittel.' }
  ],
  '04-30': [
    { title: 'National Raisin Day', desc: 'Feiert Rosinen als Snack und Backzutat.' },
    { title: 'National Bubble Tea Day', desc: 'Würdigt das beliebte Getränk mit Tapiokaperlen.' },
    { title: 'Internationaler Tag des Jazz', desc: 'UNO-Tag zur Förderung von Jazz und kulturellem Austausch.' }
  ],
  '05-01': [
    { title: 'National Chocolate Parfait Day', desc: 'Feiert das geschichtete Schokoladendessert.' },
    { title: 'National School Principals\' Day', desc: 'Würdigt Schulleitungen und ihre Arbeit.' },
    { title: 'Tag der Arbeit', desc: 'Internationaler Feiertag für Arbeitnehmerrechte.' }
  ],
  '05-02': [
    { title: 'National Truffle Day', desc: 'Feiert Trüffel und Trüffelpralinen.' },
    { title: 'National Brothers and Sisters Day', desc: 'Würdigt die Verbindung zwischen Geschwistern.' },
    { title: 'Welt-Thunfischtag', desc: 'UNO-Tag für nachhaltigen Schutz der Thunfischbestände.' }
  ],
  '05-03': [
    { title: 'National Chocolate Custard Day', desc: 'Feiert Schokoladenpudding und Cremedesserts.' },
    { title: 'National Paranormal Day', desc: 'Beschäftigt sich mit unerklärlichen Phänomenen.' },
    { title: 'Internationaler Tag der Pressefreiheit', desc: 'Fördert freie und unabhängige Medien.' }
  ],
  '05-04': [
    { title: 'National Orange Juice Day', desc: 'Feiert Orangensaft als beliebtes Getränk.' },
    { title: 'National Weather Observers Day', desc: 'Würdigt Wetterbeobachter und Meteorologie.' },
    { title: 'Star-Wars-Tag', desc: 'Feiert das berühmte Science-Fiction-Universum.' }
  ],
  '05-05': [
    { title: 'National Hoagie Day', desc: 'Feiert das belegte Sandwich amerikanischer Art.' },
    { title: 'National Cartoonists Day', desc: 'Würdigt Comiczeichner und Karikaturisten.' },
    { title: 'Europäischer Protesttag zur Gleichstellung von Menschen mit Behinderung', desc: 'Fördert Inklusion und Barrierefreiheit.' }
  ],
  '05-06': [
    { title: 'National Nurses Day', desc: 'Würdigt Pflegekräfte und ihren Einsatz.' },
    { title: 'National Crepe Suzette Day', desc: 'Feiert den französischen Dessertklassiker.' },
    { title: 'Internationaler Tag ohne Diät', desc: 'Fördert ein gesundes Körperbild.' }
  ],
  '05-07': [
    { title: 'National Tourism Day', desc: 'Würdigt Reisen und Tourismus.' },
    { title: 'National Barrier Awareness Day', desc: 'Macht auf Barrieren für Menschen mit Behinderung aufmerksam.' },
    { title: 'Welt-Asthma-Tag', desc: 'Informiert über Asthma und Behandlungsmöglichkeiten.' }
  ],
  '05-08': [
    { title: 'National Coconut Cream Pie Day', desc: 'Feiert die Kokosnusscremetorte.' },
    { title: 'National Have a Coke Day', desc: 'Würdigt das bekannte Erfrischungsgetränk.' },
    { title: 'Weltrotkreuz- und Rothalbmondtag', desc: 'Würdigt humanitäre Hilfe weltweit.' }
  ],
  '05-09': [
    { title: 'National Butterscotch Brownie Day', desc: 'Feiert Brownies mit Butterscotch.' },
    { title: 'National Sleepover Day', desc: 'Würdigt gemeinsame Übernachtungen mit Freunden.' },
    { title: 'Europatag', desc: 'Feiert Frieden und Zusammenarbeit in Europa.' }
  ],
  '05-10': [
    { title: 'National Shrimp Day', desc: 'Feiert Garnelen in der Küche.' },
    { title: 'National Clean Up Your Room Day', desc: 'Ermutigt zum Aufräumen und Organisieren.' },
    { title: 'Tag der Zugvögel', desc: 'Macht auf den Schutz wandernder Vogelarten aufmerksam.' }
  ],
  '05-11': [
    { title: 'National Eat What You Want Day', desc: 'Ermutigt dazu, das Lieblingsessen zu genießen.' },
    { title: 'National Twilight Zone Day', desc: 'Würdigt die bekannte Fernsehserie.' },
    { title: 'Welt-Dürüm-Tag', desc: 'Feiert die beliebte Teigrolle mit Füllung.' }
  ],
  '05-12': [
    { title: 'National Limerick Day', desc: 'Feiert die humorvolle Gedichtform.' },
    { title: 'National Nutty Fudge Day', desc: 'Würdigt Fudge mit Nüssen.' },
    { title: 'Internationaler Tag der Pflegenden', desc: 'Ehrt Pflegekräfte weltweit.' }
  ],
  '05-13': [
    { title: 'National Apple Pie Day', desc: 'Feiert den klassischen Apfelkuchen.' },
    { title: 'National Crouton Day', desc: 'Würdigt knusprige Brotwürfel in Salaten und Suppen.' },
    { title: 'Welt-Cocktail-Tag', desc: 'Feiert die Vielfalt der Cocktailkultur.' }
  ],
  '05-14': [
    { title: 'National Buttermilk Biscuit Day', desc: 'Feiert das traditionelle Gebäck.' },
    { title: 'National Dance Like a Chicken Day', desc: 'Spielerischer Aktionstag rund ums Tanzen.' },
    { title: 'Tag des fairen Handels', desc: 'Fördert gerechten Handel weltweit.' }
  ],
  '05-15': [
    { title: 'National Chocolate Chip Day', desc: 'Feiert Schokostückchen in Backwaren.' },
    { title: 'National Nylon Stocking Day', desc: 'Würdigt die Entwicklung von Nylonstrümpfen.' },
    { title: 'Internationaler Tag der Familie', desc: 'UNO-Tag für die Bedeutung von Familien.' }
  ],
  '05-16': [
    { title: 'National Barbecue Day', desc: 'Feiert Grillen und Grillkultur.' },
    { title: 'National Mimosa Day', desc: 'Würdigt das Getränk aus Sekt und Orangensaft.' },
    { title: 'Internationaler Tag des friedlichen Zusammenlebens', desc: 'Fördert Respekt und Zusammenhalt.' }
  ],
  '05-17': [
    { title: 'National Cherry Cobbler Day', desc: 'Feiert das traditionelle Kirschdessert.' },
    { title: 'National Walnut Day', desc: 'Würdigt die Walnuss als gesunde Zutat.' },
    { title: 'Internationaler Tag gegen Homo-, Bi-, Inter- und Transfeindlichkeit', desc: 'Setzt ein Zeichen für Gleichberechtigung.' }
  ],
  '05-18': [
    { title: 'National Cheese Soufflé Day', desc: 'Feiert das luftige Käsegericht.' },
    { title: 'National No Dirty Dishes Day', desc: 'Ermutigt zu einem Tag ohne Abwasch.' },
    { title: 'Internationaler Museumstag', desc: 'Würdigt Museen und kulturelles Erbe.' }
  ],
  '05-19': [
    { title: 'National Devil\'s Food Cake Day', desc: 'Feiert den schokoladigen Kuchenklassiker.' },
    { title: 'National May Ray Day', desc: 'Ermutigt dazu, Sonne und Natur zu genießen.' },
    { title: 'Welt-CED-Tag', desc: 'Macht auf chronisch entzündliche Darmerkrankungen aufmerksam.' }
  ],
  '05-20': [
    { title: 'National Quiche Lorraine Day', desc: 'Feiert die französische Spezialität.' },
    { title: 'National Pick Strawberries Day', desc: 'Ermutigt zum Erdbeerpflücken.' },
    { title: 'Weltbienentag', desc: 'UNO-Tag zum Schutz von Bienen und Bestäubern.' }
  ],
  '05-21': [
    { title: 'National Waitstaff Day', desc: 'Würdigt Servicekräfte in Restaurants.' },
    { title: 'National Strawberries and Cream Day', desc: 'Feiert Erdbeeren mit Sahne.' },
    { title: 'Welttag der kulturellen Vielfalt', desc: 'Fördert kulturellen Austausch und Verständnis.' }
  ],
  '05-22': [
    { title: 'National Vanilla Pudding Day', desc: 'Feiert Vanillepudding als Dessertklassiker.' },
    { title: 'National Maritime Day', desc: 'Würdigt die Schifffahrt und Seeleute.' },
    { title: 'Internationaler Tag der biologischen Vielfalt', desc: 'UNO-Tag zum Schutz der Artenvielfalt.' }
  ],
  '05-23': [
    { title: 'National Taffy Day', desc: 'Feiert die weiche Süßigkeit Taffy.' },
    { title: 'National Lucky Penny Day', desc: 'Würdigt Glückspfennige und kleine Glücksmomente.' },
    { title: 'Weltschildkrötentag', desc: 'Macht auf den Schutz von Schildkröten aufmerksam.' }
  ],
  '05-24': [
    { title: 'National Scavenger Hunt Day', desc: 'Feiert Schatz- und Suchspiele.' },
    { title: 'National Asparagus Day', desc: 'Würdigt Spargel als beliebtes Gemüse.' },
    { title: 'Internationaler Tag der Frauen für Frieden und Abrüstung', desc: 'Setzt sich für Frieden und Gleichberechtigung ein.' }
  ],
  '05-25': [
    { title: 'National Wine Day', desc: 'Feiert Wein und seine Kulturgeschichte.' },
    { title: 'National Brown-Bag-It Day', desc: 'Ermutigt dazu, eigenes Essen mitzunehmen.' },
    { title: 'Internationaler Tag vermisster Kinder', desc: 'Macht auf das Schicksal vermisster Kinder aufmerksam.' }
  ],
  '05-26': [
    { title: 'National Blueberry Cheesecake Day', desc: 'Feiert Heidelbeer-Käsekuchen.' },
    { title: 'National Paper Airplane Day', desc: 'Würdigt Papierflieger und Kreativität.' },
    { title: 'Welt-Lindy-Hop-Tag', desc: 'Feiert den bekannten Swingtanz.' }
  ],
  '05-27': [
    { title: 'National Grape Popsicle Day', desc: 'Feiert Eis am Stiel mit Traubengeschmack.' },
    { title: 'National Sunscreen Day', desc: 'Erinnert an den Schutz vor UV-Strahlung.' },
    { title: 'Tag der Notfallmedizin', desc: 'Würdigt Rettungsdienste und Notfallversorgung.' }
  ],
  '05-28': [
    { title: 'National Hamburger Day', desc: 'Feiert den Hamburger als Klassiker.' },
    { title: 'National Brisket Day', desc: 'Würdigt langsam gegartes Rindfleisch.' },
    { title: 'Weltmenstruationstag', desc: 'Fördert Aufklärung und Enttabuisierung der Menstruation.' }
  ],
  '05-29': [
    { title: 'National Biscuit Day', desc: 'Feiert das traditionelle Gebäck.' },
    { title: 'National Paperclip Day', desc: 'Würdigt die Büroklammer als Alltagshelfer.' },
    { title: 'Internationaler Tag der UN-Friedenstruppen', desc: 'Ehrt Friedenseinsätze der Vereinten Nationen.' }
  ],
  '05-30': [
    { title: 'National Mint Julep Day', desc: 'Feiert das bekannte Minzgetränk.' },
    { title: 'National Water a Flower Day', desc: 'Ermutigt zur Pflege von Pflanzen.' },
    { title: 'Welt-MS-Tag', desc: 'Macht auf Multiple Sklerose aufmerksam.' }
  ],
  '05-31': [
    { title: 'National Macaroon Day', desc: 'Feiert das Kokosgebäck Makrone.' },
    { title: 'National Smile Day', desc: 'Ermutigt dazu, anderen ein Lächeln zu schenken.' },
    { title: 'Weltnichtrauchertag', desc: 'Fördert einen rauchfreien Lebensstil.' }
  ],
  '06-01': [
    { title: 'National Olive Day', desc: 'Feiert die Olive als vielseitige Frucht.' },
    { title: 'National Say Something Nice Day', desc: 'Ermutigt zu freundlichen Worten im Alltag.' },
    { title: 'Internationaler Kindertag', desc: 'Feiert die Rechte und das Wohl von Kindern.' }
  ],
  '06-02': [
    { title: 'National Rocky Road Day', desc: 'Feiert das beliebte Eis mit Marshmallows.' },
    { title: 'National Leave the Office Early Day', desc: 'Ermutigt zu einer besseren Work-Life-Balance.' },
    { title: 'Internationaler Hurentag', desc: 'Macht auf die Rechte von Sexarbeitern aufmerksam.' }
  ],
  '06-03': [
    { title: 'National Egg Day', desc: 'Feiert Eier als vielseitiges Lebensmittel.' },
    { title: 'National Chocolate Macaroon Day', desc: 'Würdigt die Schokoladen-Makrone.' },
    { title: 'Weltfahrradtag', desc: 'UNO-Tag zur Förderung des Fahrradfahrens.' }
  ],
  '06-04': [
    { title: 'National Cheese Day', desc: 'Feiert Käse in all seinen Varianten.' },
    { title: 'National Cognac Day', desc: 'Würdigt den französischen Weinbrand.' },
    { title: 'Internationaler Tag der Kinder als Opfer von Aggression', desc: 'Gedenkt Kindern in Konfliktgebieten.' }
  ],
  '06-05': [
    { title: 'National Ketchup Day', desc: 'Feiert Ketchup als beliebte Würzsauce.' },
    { title: 'National Veggie Burger Day', desc: 'Würdigt vegetarische Burger.' },
    { title: 'Weltumwelttag', desc: 'UNO-Tag für Umwelt- und Klimaschutz.' }
  ],
  '06-06': [
    { title: 'National Gardening Exercise Day', desc: 'Verbindet Gartenarbeit mit Bewegung.' },
    { title: 'National Higher Education Day', desc: 'Fördert Bildung und lebenslanges Lernen.' },
    { title: 'Tag der russischen Sprache', desc: 'UNO-Tag zur Förderung der russischen Sprache.' }
  ],
  '06-07': [
    { title: 'National Chocolate Ice Cream Day', desc: 'Feiert Schokoladeneis als Dessert.' },
    { title: 'National VCR Day', desc: 'Würdigt Videorekorder und Heimkino-Geschichte.' },
    { title: 'Welttag der Lebensmittelsicherheit', desc: 'Fördert sichere Lebensmittel weltweit.' }
  ],
  '06-08': [
    { title: 'National Best Friends Day', desc: 'Feiert enge Freundschaften.' },
    { title: 'National Upsy Daisy Day', desc: 'Ermutigt zu einem positiven Start in den Tag.' },
    { title: 'Welttag der Ozeane', desc: 'UNO-Tag zum Schutz der Meere.' }
  ],
  '06-09': [
    { title: 'National Strawberry Rhubarb Pie Day', desc: 'Feiert Erdbeer-Rhabarber-Kuchen.' },
    { title: 'National Earl Day', desc: 'Würdigt Menschen mit dem Namen Earl.' },
    { title: 'Internationaler Tag der Archive', desc: 'Macht auf die Bedeutung von Archiven aufmerksam.' }
  ],
  '06-10': [
    { title: 'National Iced Tea Day', desc: 'Feiert Eistee als Erfrischungsgetränk.' },
    { title: 'National Herbs and Spices Day', desc: 'Würdigt Kräuter und Gewürze.' },
    { title: 'Welttag des Jugendstils', desc: 'Feiert Kunst und Architektur des Jugendstils.' }
  ],
  '06-11': [
    { title: 'National Corn on the Cob Day', desc: 'Feiert frischen Maiskolben als Sommergericht.' },
    { title: 'National German Chocolate Cake Day', desc: 'Würdigt den Schokoladenkuchen-Klassiker.' },
    { title: 'Internationaler Tag des Spielens', desc: 'Fördert die Bedeutung des Spielens für alle Altersgruppen.' }
  ],
  '06-12': [
    { title: 'National Peanut Butter Cookie Day', desc: 'Feiert Erdnussbutterkekse.' },
    { title: 'National Red Rose Day', desc: 'Würdigt die rote Rose als Symbol der Liebe.' },
    { title: 'Welttag gegen Kinderarbeit', desc: 'UNO-Tag gegen Ausbeutung von Kindern.' }
  ],
  '06-13': [
    { title: 'National Kitchen Klutzes of America Day', desc: 'Nimmt Missgeschicke in der Küche mit Humor.' },
    { title: 'National Weed Your Garden Day', desc: 'Ermutigt zur Gartenpflege.' },
    { title: 'Internationaler Albinismus-Aufklärungstag', desc: 'Fördert Verständnis für Menschen mit Albinismus.' }
  ],
  '06-14': [
    { title: 'National Strawberry Shortcake Day', desc: 'Feiert das Dessert mit Erdbeeren.' },
    { title: 'National Pop Goes the Weasel Day', desc: 'Würdigt das bekannte Kinderlied.' },
    { title: 'Weltblutspendetag', desc: 'Fördert freiwillige Blutspenden.' }
  ],
  '06-15': [
    { title: 'National Lobster Day', desc: 'Feiert Hummer als Delikatesse.' },
    { title: 'National Smile Power Day', desc: 'Ermutigt dazu, mit einem Lächeln Freude zu verbreiten.' },
    { title: 'Welttag gegen Misshandlung älterer Menschen', desc: 'Macht auf Gewalt gegen Senioren aufmerksam.' }
  ],
  '06-16': [
    { title: 'National Fudge Day', desc: 'Feiert die Süßigkeit Fudge.' },
    { title: 'National Fresh Veggies Day', desc: 'Würdigt frisches Gemüse.' },
    { title: 'Internationaler Tag des afrikanischen Kindes', desc: 'Fördert Bildung und Rechte afrikanischer Kinder.' }
  ],
  '06-17': [
    { title: 'National Apple Strudel Day', desc: 'Feiert den traditionellen Apfelstrudel.' },
    { title: 'National Eat Your Vegetables Day', desc: 'Ermutigt zu gesunder Ernährung.' },
    { title: 'Welttag zur Bekämpfung von Wüstenbildung und Dürre', desc: 'UNO-Tag zum Schutz fruchtbarer Böden.' }
  ],
  '06-18': [
    { title: 'National Splurge Day', desc: 'Erlaubt sich eine kleine besondere Freude.' },
    { title: 'National Go Fishing Day', desc: 'Feiert das Angeln als Freizeitbeschäftigung.' },
    { title: 'Tag der nachhaltigen Gastronomie', desc: 'Fördert nachhaltige Lebensmittelproduktion.' }
  ],
  '06-19': [
    { title: 'National Martini Day', desc: 'Feiert den klassischen Cocktail.' },
    { title: 'National Garfield the Cat Day', desc: 'Würdigt die bekannte Comic-Katze.' },
    { title: 'Internationaler Tag zur Beseitigung sexueller Gewalt in Konflikten', desc: 'UNO-Tag für den Schutz von Betroffenen.' }
  ],
  '06-20': [
    { title: 'National Vanilla Milkshake Day', desc: 'Feiert den Vanille-Milchshake.' },
    { title: 'National American Eagle Day', desc: 'Würdigt den Weißkopfseeadler.' },
    { title: 'Weltflüchtlingstag', desc: 'UNO-Tag für Schutz und Unterstützung von Flüchtlingen.' }
  ],
  '06-21': [
    { title: 'National Peaches and Cream Day', desc: 'Feiert Pfirsiche mit Sahne als Sommerdessert.' },
    { title: 'National Selfie Day', desc: 'Würdigt Selbstporträts mit dem Smartphone.' },
    { title: 'Internationaler Tag des Yoga', desc: 'UNO-Tag zur Förderung von Gesundheit und Wohlbefinden.' }
  ],
  '06-22': [
    { title: 'National Chocolate Éclair Day', desc: 'Feiert das mit Creme gefüllte Brandteiggebäck.' },
    { title: 'National Onion Rings Day', desc: 'Würdigt frittierte Zwiebelringe als Snack.' },
    { title: 'Welttag des Regenwaldes', desc: 'Macht auf den Schutz tropischer Wälder aufmerksam.' }
  ],
  '06-23': [
    { title: 'National Pink Day', desc: 'Feiert die Farbe Pink in Kultur und Mode.' },
    { title: 'National Hydration Day', desc: 'Erinnert an ausreichendes Trinken.' },
    { title: 'Tag des öffentlichen Dienstes', desc: 'UNO-Tag zur Würdigung öffentlicher Beschäftigter.' }
  ],
  '06-24': [
    { title: 'National Pralines Day', desc: 'Feiert die Süßigkeit Praline.' },
    { title: 'National Take Your Dog to Work Day', desc: 'Ermutigt dazu, Hunde mit zur Arbeit zu bringen.' },
    { title: 'Internationaler Feentag', desc: 'Feiert Feen und Fantasiegeschichten.' }
  ],
  '06-25': [
    { title: 'National Strawberry Parfait Day', desc: 'Feiert das geschichtete Erdbeerdessert.' },
    { title: 'National Catfish Day', desc: 'Würdigt den Wels als Speisefisch.' },
    { title: 'Tag der Seeleute', desc: 'UNO-Tag zur Anerkennung der Arbeit von Seeleuten.' }
  ],
  '06-26': [
    { title: 'National Chocolate Pudding Day', desc: 'Feiert Schokoladenpudding als Dessert.' },
    { title: 'National Canoe Day', desc: 'Würdigt das Kanu und den Wassersport.' },
    { title: 'Internationaler Tag gegen Drogenmissbrauch und unerlaubten Handel', desc: 'UNO-Tag zur Prävention von Drogenmissbrauch.' }
  ],
  '06-27': [
    { title: 'National Ice Cream Cake Day', desc: 'Feiert Eistorten als sommerliche Nachspeise.' },
    { title: 'National Sunglasses Day', desc: 'Würdigt Sonnenbrillen und Augenschutz.' },
    { title: 'Tag der Mikro-, kleinen und mittleren Unternehmen', desc: 'UNO-Tag zur Unterstützung kleiner Unternehmen.' }
  ],
  '06-28': [
    { title: 'National Tapioca Day', desc: 'Feiert Tapioka in Desserts und Getränken.' },
    { title: 'National Insurance Awareness Day', desc: 'Informiert über Versicherungen und Vorsorge.' },
    { title: 'Christopher Street Day', desc: 'Feiert Vielfalt und die Rechte von LGBTQ+-Menschen.' }
  ],
  '06-29': [
    { title: 'National Almond Buttercrunch Day', desc: 'Feiert die Süßigkeit mit Mandeln und Karamell.' },
    { title: 'National Camera Day', desc: 'Würdigt Fotografie und Kameratechnik.' },
    { title: 'Internationaler Tag der Tropen', desc: 'UNO-Tag für tropische Regionen und ihre Bedeutung.' }
  ],
  '06-30': [
    { title: 'National Meteor Watch Day', desc: 'Ermutigt zur Beobachtung des Nachthimmels.' },
    { title: 'National Corvette Day', desc: 'Würdigt den bekannten Sportwagen.' },
    { title: 'Internationaler Tag der Parlamentarier', desc: 'UNO-Tag zur Förderung demokratischer Institutionen.' }
  ],
  '07-01': [
    { title: 'National Postal Worker Day', desc: 'Würdigt Postzusteller und ihre Arbeit.' },
    { title: 'National Creative Ice Cream Flavors Day', desc: 'Feiert kreative Eissorten und neue Ideen.' },
    { title: 'Internationaler Tag der Genossenschaften', desc: 'Fördert gemeinschaftliches wirtschaftliches Handeln.' }
  ],
  '07-02': [
    { title: 'National Anisette Day', desc: 'Feiert den Anislikör und seine Tradition.' },
    { title: 'National I Forgot Day', desc: 'Nimmt Vergesslichkeit mit Humor.' },
    { title: 'Welt-UFO-Tag', desc: 'Beschäftigt sich mit ungeklärten Himmelsphänomenen.' }
  ],
  '07-03': [
    { title: 'National Eat Beans Day', desc: 'Feiert Bohnen als vielseitiges Lebensmittel.' },
    { title: 'National Fried Clam Day', desc: 'Würdigt frittierte Muscheln als Spezialität.' },
    { title: 'Internationaler plastiktütenfreier Tag', desc: 'Fördert die Reduzierung von Einwegplastik.' }
  ],
  '07-04': [
    { title: 'National Caesar Salad Day', desc: 'Feiert den Caesar Salad.' },
    { title: 'National Barbecued Spareribs Day', desc: 'Würdigt gegrillte Schweinerippchen.' },
    { title: 'Unabhängigkeitstag der USA', desc: 'Nationalfeiertag der Vereinigten Staaten.' }
  ],
  '07-05': [
    { title: 'National Apple Turnover Day', desc: 'Feiert die mit Äpfeln gefüllte Teigtasche.' },
    { title: 'National Graham Cracker Day', desc: 'Würdigt den beliebten Keks.' },
    { title: 'Internationaler Tag der Arbeitsbiene', desc: 'Macht auf die Bedeutung von Bestäubern aufmerksam.' }
  ],
  '07-06': [
    { title: 'National Fried Chicken Day', desc: 'Feiert frittiertes Hähnchen.' },
    { title: 'National Hand Roll Day', desc: 'Würdigt Sushi-Handrollen.' },
    { title: 'Internationaler Tag des Kusses', desc: 'Feiert Zuneigung und Nähe zwischen Menschen.' }
  ],
  '07-07': [
    { title: 'National Strawberry Sundae Day', desc: 'Feiert das Eisdessert mit Erdbeeren.' },
    { title: 'National Father Daughter Take a Walk Day', desc: 'Ermutigt zu gemeinsamer Zeit im Freien.' },
    { title: 'Welt-Schokoladentag', desc: 'Feiert Schokolade in all ihren Formen.' }
  ],
  '07-08': [
    { title: 'National Chocolate with Almonds Day', desc: 'Feiert Schokolade mit Mandeln.' },
    { title: 'National Freezer Pop Day', desc: 'Würdigt gefrorene Eisriegel.' },
    { title: 'Weltallergietag', desc: 'Macht auf Allergien und ihre Behandlung aufmerksam.' }
  ],
  '07-09': [
    { title: 'National Sugar Cookie Day', desc: 'Feiert den klassischen Zuckerkeks.' },
    { title: 'National Dimples Day', desc: 'Würdigt Grübchen als besonderes Merkmal.' },
    { title: 'Tag der Vernichtung von Kleinwaffen', desc: 'UNO-Tag für Abrüstung und Sicherheit.' }
  ],
  '07-10': [
    { title: 'National Piña Colada Day', desc: 'Feiert den tropischen Cocktail.' },
    { title: 'National Kitten Day', desc: 'Würdigt junge Katzen und Tierschutz.' },
    { title: 'Internationaler Tag der Gerichtsjustiz', desc: 'Fördert internationale Rechtsstaatlichkeit.' }
  ],
  '07-11': [
    { title: 'National Blueberry Muffin Day', desc: 'Feiert Muffins mit Heidelbeeren.' },
    { title: 'National Mojito Day', desc: 'Würdigt den bekannten Minz-Cocktail.' },
    { title: 'Weltbevölkerungstag', desc: 'UNO-Tag zu Bevölkerungsentwicklung und Nachhaltigkeit.' }
  ],
  '07-12': [
    { title: 'National Pecan Pie Day', desc: 'Feiert Pekannusskuchen als Dessert.' },
    { title: 'National Different Colored Eyes Day', desc: 'Würdigt Menschen mit verschiedenfarbigen Augen.' },
    { title: 'Malala Day', desc: 'UNO-Tag für Bildung und die Rechte von Mädchen.' }
  ],
  '07-13': [
    { title: 'National French Fry Day', desc: 'Feiert Pommes frites in allen Varianten.' },
    { title: 'National Beans \'n\' Franks Day', desc: 'Würdigt das Gericht aus Bohnen und Würstchen.' },
    { title: 'Internationaler Tag des Rock\'n\'Roll', desc: 'Feiert die Musikrichtung und ihre Geschichte.' }
  ],
  '07-14': [
    { title: 'National Mac and Cheese Day', desc: 'Feiert Makkaroni mit Käse.' },
    { title: 'National Tape Measure Day', desc: 'Würdigt das Maßband als Werkzeug.' },
    { title: 'Internationaler Tag des Nacktbadens', desc: 'Aktionstag für Freikörperkultur.' }
  ],
  '07-15': [
    { title: 'National Gummi Worm Day', desc: 'Feiert Fruchtgummi-Würmer als Süßigkeit.' },
    { title: 'National Give Something Away Day', desc: 'Ermutigt zum Teilen und Spenden.' },
    { title: 'Welttag der Jugendkompetenzen', desc: 'UNO-Tag zur Förderung beruflicher Fähigkeiten.' }
  ],
  '07-16': [
    { title: 'National Corn Fritters Day', desc: 'Feiert Maisküchlein als Snack.' },
    { title: 'National Personal Chef Day', desc: 'Würdigt persönliche Köche und ihre Arbeit.' },
    { title: 'Welt-Schlangentag', desc: 'Macht auf die Bedeutung von Schlangen aufmerksam.' }
  ],
  '07-17': [
    { title: 'National Peach Ice Cream Day', desc: 'Feiert Pfirsicheis als Sommerdessert.' },
    { title: 'National Tattoo Day', desc: 'Würdigt Tätowierungen als Kunstform.' },
    { title: 'Welttag für internationale Strafjustiz', desc: 'Fördert Gerechtigkeit und Menschenrechte.' }
  ],
  '07-18': [
    { title: 'National Caviar Day', desc: 'Feiert Kaviar als Delikatesse.' },
    { title: 'National Sour Candy Day', desc: 'Würdigt saure Süßigkeiten.' },
    { title: 'Nelson-Mandela-Tag', desc: 'UNO-Gedenktag für Frieden und gesellschaftliches Engagement.' }
  ],
  '07-19': [
    { title: 'National Daiquiri Day', desc: 'Feiert den klassischen Cocktail.' },
    { title: 'National Raspberry Cake Day', desc: 'Würdigt Himbeerkuchen als Dessert.' },
    { title: 'Internationaler Rettertag', desc: 'Ehrt Menschen in Rettungsberufen.' }
  ],
  '07-20': [
    { title: 'National Lollipop Day', desc: 'Feiert den Lutscher als Süßigkeit.' },
    { title: 'National Moon Day', desc: 'Erinnert an die erste Mondlandung.' },
    { title: 'Internationaler Schachtag', desc: 'UNO-Tag zur Förderung des Schachspiels.' }
  ],
  '07-21': [
    { title: 'National Junk Food Day', desc: 'Feiert beliebte Snacks und Fast Food.' },
    { title: 'National Be Someone Day', desc: 'Ermutigt dazu, anderen positiv zu helfen.' },
    { title: 'Welt-Hundetag', desc: 'Würdigt Hunde als treue Begleiter.' }
  ],
  '07-22': [
    { title: 'National Mango Day', desc: 'Feiert die Mango als tropische Frucht.' },
    { title: 'National Hammock Day', desc: 'Würdigt die Hängematte zur Entspannung.' },
    { title: 'Spoonerism Day', desc: 'Feiert Wortspiele durch Lautvertauschungen.' }
  ],
  '07-23': [
    { title: 'National Vanilla Ice Cream Day', desc: 'Feiert Vanilleeis als Dessertklassiker.' },
    { title: 'National Gorgeous Grandma Day', desc: 'Würdigt Großmütter jeden Alters.' },
    { title: 'Welttag der Wale und Delfine', desc: 'Macht auf den Schutz von Meeressäugern aufmerksam.' }
  ],
  '07-24': [
    { title: 'National Tequila Day', desc: 'Feiert den mexikanischen Agavenschnaps.' },
    { title: 'National Drive-Thru Day', desc: 'Würdigt den praktischen Bestellservice.' },
    { title: 'Internationaler Tag der Selbstfürsorge', desc: 'Fördert bewusste Selbstfürsorge und Gesundheit.' }
  ],
  '07-25': [
    { title: 'National Hot Fudge Sundae Day', desc: 'Feiert das Eisdessert mit Schokoladensoße.' },
    { title: 'National Merry-Go-Round Day', desc: 'Würdigt historische Karussells.' },
    { title: 'Welttag zur Verhütung des Ertrinkens', desc: 'UNO-Tag für Wasser- und Badesicherheit.' }
  ],
  '07-26': [
    { title: 'National Coffee Milkshake Day', desc: 'Feiert den Milchshake mit Kaffee.' },
    { title: 'National All or Nothing Day', desc: 'Ermutigt zu entschlossenem Handeln.' },
    { title: 'Internationaler Tag zum Schutz der Mangroven', desc: 'UNO-Tag für Küsten- und Umweltschutz.' }
  ],
  '07-27': [
    { title: 'National Crème Brûlée Day', desc: 'Feiert das französische Dessert.' },
    { title: 'National Scotch Day', desc: 'Würdigt schottischen Whisky.' },
    { title: 'Schlafmützentrag', desc: 'Erinnert an die Bedeutung ausreichenden Schlafs.' }
  ],
  '07-28': [
    { title: 'National Milk Chocolate Day', desc: 'Feiert Vollmilchschokolade.' },
    { title: 'National Waterpark Day', desc: 'Würdigt Wasserparks und Freizeitspaß.' },
    { title: 'Welt-Hepatitis-Tag', desc: 'Informiert über Hepatitis und Prävention.' }
  ],
  '07-29': [
    { title: 'National Chicken Wing Day', desc: 'Feiert Hähnchenflügel als beliebten Snack.' },
    { title: 'National Lasagna Day', desc: 'Würdigt die italienische Nudel-Spezialität.' },
    { title: 'Internationaler Tag des Tigers', desc: 'Macht auf den Schutz von Tigern aufmerksam.' }
  ],
  '07-30': [
    { title: 'National Cheesecake Day', desc: 'Feiert Käsekuchen in vielen Variationen.' },
    { title: 'National Father-in-Law Day', desc: 'Würdigt Schwiegerväter.' },
    { title: 'Internationaler Tag der Freundschaft', desc: 'UNO-Tag für Freundschaft und Verständigung.' }
  ],
  '07-31': [
    { title: 'National Avocado Day', desc: 'Feiert die Avocado als vielseitige Frucht.' },
    { title: 'National Raspberry Cake Day', desc: 'Würdigt Himbeerkuchen als Dessert.' },
    { title: 'Welt-Ranger-Tag', desc: 'Ehrt Ranger und Naturschützer weltweit.' }
  ],
  '08-01': [
    { title: 'National Raspberry Cream Pie Day', desc: 'Feiert Himbeer-Sahne-Torte als Sommerdessert.' },
    { title: 'National Girlfriends Day', desc: 'Würdigt Freundschaften zwischen Frauen.' },
    { title: 'World Wide Web Day', desc: 'Feiert die Erfindung und Bedeutung des Webs.' }
  ],
  '08-02': [
    { title: 'National Ice Cream Sandwich Day', desc: 'Feiert das Eis-Sandwich als Sommersnack.' },
    { title: 'National Coloring Book Day', desc: 'Würdigt Malbücher für Kinder und Erwachsene.' },
    { title: 'Internationaler Tag des Biers', desc: 'Feiert Bier und Braukultur weltweit.' }
  ],
  '08-03': [
    { title: 'National Watermelon Day', desc: 'Feiert die Wassermelone als Sommerfrucht.' },
    { title: 'National Grab Some Nuts Day', desc: 'Würdigt Nüsse als gesunden Snack.' },
    { title: 'Cloves Syndrome Awareness Day', desc: 'Macht auf die seltene Erkrankung CLOVES aufmerksam.' }
  ],
  '08-04': [
    { title: 'National Chocolate Chip Cookie Day', desc: 'Feiert den Schokoladenkeks-Klassiker.' },
    { title: 'National Coast Guard Day', desc: 'Würdigt die Küstenwache.' },
    { title: 'Internationaler Tag des Schneeleoparden', desc: 'Macht auf den Schutz der Großkatze aufmerksam.' }
  ],
  '08-05': [
    { title: 'National Oyster Day', desc: 'Feiert Austern als Delikatesse.' },
    { title: 'National Underwear Day', desc: 'Würdigt die Entwicklung von Unterwäsche.' },
    { title: 'Blogger Day', desc: 'Feiert Blogger und digitale Inhalte.' }
  ],
  '08-06': [
    { title: 'National Root Beer Float Day', desc: 'Feiert das Getränk aus Limonade und Eis.' },
    { title: 'National Fresh Breath Day', desc: 'Erinnert an Mundhygiene und Zahnpflege.' },
    { title: 'Hiroshima-Gedenktag', desc: 'Erinnerung an die Opfer des Atombombenabwurfs.' }
  ],
  '08-07': [
    { title: 'National Lighthouse Day', desc: 'Würdigt Leuchttürme und ihre Geschichte.' },
    { title: 'National Purple Heart Day', desc: 'Ehrt Träger des Purple-Heart-Ordens.' },
    { title: 'Internationaler Tag des Leuchtturms', desc: 'Feiert maritime Orientierungshilfen.' }
  ],
  '08-08': [
    { title: 'National CBD Day', desc: 'Würdigt Produkte auf Cannabidiol-Basis.' },
    { title: 'National Dollar Day', desc: 'Feiert die Einführung des US-Dollars.' },
    { title: 'Internationaler Katzentag', desc: 'Feiert Katzen und fördert Tierschutz.' }
  ],
  '08-09': [
    { title: 'National Rice Pudding Day', desc: 'Feiert Milchreis als Dessert.' },
    { title: 'National Book Lovers Day', desc: 'Würdigt die Freude am Lesen.' },
    { title: 'Internationaler Tag der indigenen Völker', desc: 'UNO-Tag für Rechte und Kulturen indigener Menschen.' }
  ],
  '08-10': [
    { title: 'National S\'mores Day', desc: 'Feiert den Lagerfeuer-Snack mit Marshmallows.' },
    { title: 'National Lazy Day', desc: 'Ermutigt zu einem entspannten Tag.' },
    { title: 'Welttag des Löwen', desc: 'Macht auf den Schutz von Löwen aufmerksam.' }
  ],
  '08-11': [
    { title: 'National Raspberry Bombe Day', desc: 'Feiert das Himbeer-Eisdessert.' },
    { title: 'National Son and Daughter Day', desc: 'Würdigt Kinder und Familien.' },
    { title: 'Play in the Sand Day', desc: 'Ermutigt zu Spaß und Kreativität im Freien.' }
  ],
  '08-12': [
    { title: 'National Julienne Fries Day', desc: 'Feiert fein geschnittene Pommes frites.' },
    { title: 'National Vinyl Record Day', desc: 'Würdigt Schallplatten und Musikkultur.' },
    { title: 'Internationaler Tag der Jugend', desc: 'UNO-Tag für die Rechte und Chancen junger Menschen.' }
  ],
  '08-13': [
    { title: 'National Filet Mignon Day', desc: 'Feiert das zarte Rinderfilet.' },
    { title: 'National Prosecco Day', desc: 'Würdigt den italienischen Schaumwein.' },
    { title: 'Internationaler Linkshändertag', desc: 'Macht auf die Besonderheiten von Linkshändern aufmerksam.' }
  ],
  '08-14': [
    { title: 'National Creamsicle Day', desc: 'Feiert das Eis mit Vanille und Orange.' },
    { title: 'National Financial Awareness Day', desc: 'Fördert den bewussten Umgang mit Finanzen.' },
    { title: 'Welt-Eidechsentag', desc: 'Macht auf Eidechsen und ihren Schutz aufmerksam.' }
  ],
  '08-15': [
    { title: 'National Lemon Meringue Pie Day', desc: 'Feiert Zitronen-Baiser-Torte.' },
    { title: 'National Relaxation Day', desc: 'Ermutigt zu Erholung und Entspannung.' },
    { title: 'Mariä Himmelfahrt', desc: 'Christlicher Feiertag zu Ehren Marias.' }
  ],
  '08-16': [
    { title: 'National Bratwurst Day', desc: 'Feiert die Bratwurst als Spezialität.' },
    { title: 'National Roller Coaster Day', desc: 'Würdigt Achterbahnen und Freizeitparks.' },
    { title: 'Tag des Erzählen-Witzes', desc: 'Ermutigt dazu, andere zum Lachen zu bringen.' }
  ],
  '08-17': [
    { title: 'National Vanilla Custard Day', desc: 'Feiert Vanillecreme als Dessert.' },
    { title: 'National Thrift Shop Day', desc: 'Würdigt Secondhand-Läden und Nachhaltigkeit.' },
    { title: 'Indonesischer Unabhängigkeitstag', desc: 'Nationalfeiertag Indonesiens.' }
  ],
  '08-18': [
    { title: 'National Ice Cream Pie Day', desc: 'Feiert Eistorte als Sommerdessert.' },
    { title: 'National Mail Order Catalog Day', desc: 'Würdigt Versandkataloge und Handel.' },
    { title: 'Tag der schlechten Poesie', desc: 'Feiert humorvolle und ungewöhnliche Gedichte.' }
  ],
  '08-19': [
    { title: 'National Soft Ice Cream Day', desc: 'Feiert Softeis in seinen vielen Varianten.' },
    { title: 'National Aviation Day', desc: 'Würdigt Luftfahrt und Flugpioniere.' },
    { title: 'Welttag der humanitären Hilfe', desc: 'UNO-Tag für Helfer in Krisengebieten.' }
  ],
  '08-20': [
    { title: 'National Chocolate Pecan Pie Day', desc: 'Feiert Pekannuss-Schokoladenkuchen.' },
    { title: 'National Radio Day', desc: 'Würdigt das Radio als Medium.' },
    { title: 'Welt-Mückentag', desc: 'Erinnert an die Erforschung von Malaria und Mücken.' }
  ],
  '08-21': [
    { title: 'National Spumoni Day', desc: 'Feiert das italienische Eisdessert Spumoni.' },
    { title: 'National Senior Citizens Day', desc: 'Würdigt ältere Menschen und ihre Leistungen.' },
    { title: 'Internationaler Tag des Andenkens und der Ehrung der Opfer des Terrorismus', desc: 'UNO-Gedenktag für Terroropfer.' }
  ],
  '08-22': [
    { title: 'National Pecan Torte Day', desc: 'Feiert die Pekannuss-Torte.' },
    { title: 'National Be an Angel Day', desc: 'Ermutigt zu guten Taten und Hilfsbereitschaft.' },
    { title: 'Internationale Nacht der Fledermäuse', desc: 'Macht auf den Schutz von Fledermäusen aufmerksam.' }
  ],
  '08-23': [
    { title: 'National Sponge Cake Day', desc: 'Feiert den klassischen Biskuitkuchen.' },
    { title: 'National Cuban Sandwich Day', desc: 'Würdigt das traditionelle kubanische Sandwich.' },
    { title: 'Internationaler Tag zum Gedenken an den Sklavenhandel', desc: 'Erinnert an die Opfer des Sklavenhandels.' }
  ],
  '08-24': [
    { title: 'National Waffle Day', desc: 'Feiert Waffeln in vielen Variationen.' },
    { title: 'National Peach Pie Day', desc: 'Würdigt Pfirsichkuchen als Dessert.' },
    { title: 'Unabhängigkeitstag der Ukraine', desc: 'Nationalfeiertag der Ukraine.' }
  ],
  '08-25': [
    { title: 'National Banana Split Day', desc: 'Feiert das bekannte Eisdessert.' },
    { title: 'National Whiskey Sour Day', desc: 'Würdigt den klassischen Cocktail.' },
    { title: 'Kiss-and-Make-Up-Day', desc: 'Ermutigt zur Versöhnung nach Streitigkeiten.' }
  ],
  '08-26': [
    { title: 'National Dog Day', desc: 'Feiert Hunde und fördert Tierschutz.' },
    { title: 'National Cherry Popsicle Day', desc: 'Würdigt Eis am Stiel mit Kirschgeschmack.' },
    { title: 'Tag der Gleichstellung der Frau', desc: 'Erinnert an Fortschritte bei Frauenrechten.' }
  ],
  '08-27': [
    { title: 'National Just Because Day', desc: 'Ermutigt zu spontanen freundlichen Gesten.' },
    { title: 'National Pots de Crème Day', desc: 'Feiert das französische Dessert.' },
    { title: 'Welt-Ersthilfe-Tag', desc: 'Fördert Kenntnisse in Erster Hilfe.' }
  ],
  '08-28': [
    { title: 'National Red Wine Day', desc: 'Feiert Rotwein und Weinkultur.' },
    { title: 'National Bow Tie Day', desc: 'Würdigt die Fliege als Kleidungsstück.' },
    { title: 'Tag des Regenbogens', desc: 'Feiert Vielfalt und Hoffnung.' }
  ],
  '08-29': [
    { title: 'National Lemon Juice Day', desc: 'Feiert Zitronensaft als vielseitige Zutat.' },
    { title: 'National Chop Suey Day', desc: 'Würdigt das bekannte Wokgericht.' },
    { title: 'Internationaler Tag gegen Nuklearversuche', desc: 'UNO-Tag für Abrüstung und Frieden.' }
  ],
  '08-30': [
    { title: 'National Toasted Marshmallow Day', desc: 'Feiert geröstete Marshmallows.' },
    { title: 'National Beach Day', desc: 'Würdigt Strände und Erholung am Meer.' },
    { title: 'Internationaler Tag der Opfer des Verschwindenlassens', desc: 'UNO-Gedenktag für Vermisste.' }
  ],
  '08-31': [
    { title: 'National Trail Mix Day', desc: 'Feiert die Mischung aus Nüssen und Trockenfrüchten.' },
    { title: 'National Eat Outside Day', desc: 'Ermutigt zum Essen im Freien.' },
    { title: 'Internationaler Tag der Menschen afrikanischer Herkunft', desc: 'UNO-Tag gegen Diskriminierung und für Gleichberechtigung.' }
  ],
  '09-01': [
    { title: 'National Cherry Popover Day', desc: 'Feiert das Gebäck mit Kirschfüllung.' },
    { title: 'National No Rhyme (Nor Reason) Day', desc: 'Feiert kreative Sprache und Wortspiele.' },
    { title: 'Weltbriefschreibetag', desc: 'Ermutigt zum Schreiben persönlicher Briefe.' }
  ],
  '09-02': [
    { title: 'National Blueberry Popsicle Day', desc: 'Feiert Eis am Stiel mit Heidelbeergeschmack.' },
    { title: 'National V-J Day', desc: 'Erinnert an das Ende des Zweiten Weltkriegs im Pazifik.' },
    { title: 'Welttag der Kokosnuss', desc: 'Würdigt die vielseitige Kokosnuss.' }
  ],
  '09-03': [
    { title: 'National Welsh Rarebit Day', desc: 'Feiert die britische Käsespezialität.' },
    { title: 'National Skyscraper Day', desc: 'Würdigt Wolkenkratzer und Architektur.' },
    { title: 'Tag des Wolkenkratzers', desc: 'Erinnert an die Entwicklung moderner Hochhäuser.' }
  ],
  '09-04': [
    { title: 'National Wildlife Day', desc: 'Macht auf den Schutz von Wildtieren aufmerksam.' },
    { title: 'National Macadamia Nut Day', desc: 'Feiert die Macadamianuss.' },
    { title: 'Zeitungsboten-Tag', desc: 'Würdigt die Arbeit von Zeitungsausträgern.' }
  ],
  '09-05': [
    { title: 'National Cheese Pizza Day', desc: 'Feiert die klassische Käsepizza.' },
    { title: 'National Be Late for Something Day', desc: 'Nimmt kleine Verspätungen mit Humor.' },
    { title: 'Internationaler Tag der Wohltätigkeit', desc: 'UNO-Tag für Hilfsbereitschaft und Engagement.' }
  ],
  '09-06': [
    { title: 'National Coffee Ice Cream Day', desc: 'Feiert Kaffeeeis als Dessert.' },
    { title: 'National Read a Book Day', desc: 'Ermutigt zum Lesen eines Buches.' },
    { title: 'Tag gegen das Vergessen', desc: 'Erinnerung an Demenz und Gedächtniserkrankungen.' }
  ],
  '09-07': [
    { title: 'National Salami Day', desc: 'Feiert Salami als Wurstspezialität.' },
    { title: 'National Beer Lover\'s Day', desc: 'Würdigt Bier und Braukultur.' },
    { title: 'Internationaler Tag der sauberen Luft für blauen Himmel', desc: 'UNO-Tag für Luftqualität und Umweltschutz.' }
  ],
  '09-08': [
    { title: 'National Date Nut Bread Day', desc: 'Feiert Dattel-Nuss-Brot.' },
    { title: 'National Ampersand Day', desc: 'Würdigt das Zeichen "&".' },
    { title: 'Weltalphabetisierungstag', desc: 'UNO-Tag für Bildung und Lesen.' }
  ],
  '09-09': [
    { title: 'National Wiener Schnitzel Day', desc: 'Feiert das bekannte Schnitzelgericht.' },
    { title: 'National Teddy Bear Day', desc: 'Würdigt Teddybären als Spielzeugklassiker.' },
    { title: 'Internationaler Tag zum Schutz von Bildung vor Angriffen', desc: 'UNO-Tag für sichere Bildung.' }
  ],
  '09-10': [
    { title: 'National TV Dinner Day', desc: 'Feiert Fertiggerichte für das Fernsehen.' },
    { title: 'National Swap Ideas Day', desc: 'Fördert den Austausch von Ideen.' },
    { title: 'Welttag der Suizidprävention', desc: 'Macht auf Prävention und Unterstützung aufmerksam.' }
  ],
  '09-11': [
    { title: 'National Hot Cross Bun Day', desc: 'Feiert das traditionelle Rosinengebäck.' },
    { title: 'National Make Your Bed Day', desc: 'Ermutigt zu Ordnung und guten Gewohnheiten.' },
    { title: 'Patriot Day', desc: 'Gedenkt der Opfer der Anschläge vom 11. September 2001.' }
  ],
  '09-12': [
    { title: 'National Chocolate Milkshake Day', desc: 'Feiert den Schokoladen-Milchshake.' },
    { title: 'National Video Games Day', desc: 'Würdigt Videospiele und ihre Kultur.' },
    { title: 'Tag der Vereinten Nationen für Süd-Süd-Zusammenarbeit', desc: 'Fördert Zusammenarbeit zwischen Entwicklungsländern.' }
  ],
  '09-13': [
    { title: 'National Peanut Day', desc: 'Feiert die Erdnuss als Snack und Zutat.' },
    { title: 'National Bald Is Beautiful Day', desc: 'Würdigt Menschen ohne Haare.' },
    { title: 'Tag des positiven Denkens', desc: 'Ermutigt zu einer optimistischen Haltung.' }
  ],
  '09-14': [
    { title: 'National Cream-Filled Donut Day', desc: 'Feiert den gefüllten Donut.' },
    { title: 'National Live Creative Day', desc: 'Fördert kreatives Denken und Handeln.' },
    { title: 'Internationaler Tag des ersten Hilfseinsatzes', desc: 'Würdigt humanitäre Hilfe weltweit.' }
  ],
  '09-15': [
    { title: 'National Cheese Toast Day', desc: 'Feiert überbackenes Käsebrot.' },
    { title: 'National Linguine Day', desc: 'Würdigt die italienische Pastasorte.' },
    { title: 'Internationaler Tag der Demokratie', desc: 'UNO-Tag für demokratische Werte.' }
  ],
  '09-16': [
    { title: 'National Guacamole Day', desc: 'Feiert Guacamole aus Avocados.' },
    { title: 'National Play-Doh Day', desc: 'Würdigt die bekannte Modelliermasse.' },
    { title: 'Internationaler Tag zum Schutz der Ozonschicht', desc: 'UNO-Tag für den Schutz der Atmosphäre.' }
  ],
  '09-17': [
    { title: 'National Apple Dumpling Day', desc: 'Feiert das Apfeldessert im Teigmantel.' },
    { title: 'National Monte Cristo Day', desc: 'Würdigt das warme Sandwich.' },
    { title: 'Welttag der Patientensicherheit', desc: 'Fördert sichere medizinische Versorgung.' }
  ],
  '09-18': [
    { title: 'National Cheeseburger Day', desc: 'Feiert den Cheeseburger-Klassiker.' },
    { title: 'National Respect Day', desc: 'Ermutigt zu gegenseitigem Respekt.' },
    { title: 'Internationaler Tag der gleichen Bezahlung', desc: 'UNO-Tag für Lohngleichheit.' }
  ],
  '09-19': [
    { title: 'National Butterscotch Pudding Day', desc: 'Feiert das Karamellpudding-Dessert.' },
    { title: 'National Talk Like a Pirate Day', desc: 'Spielerischer Aktionstag in Piratensprache.' },
    { title: 'World Cleanup Day', desc: 'Fördert gemeinschaftliche Müllsammelaktionen.' }
  ],
  '09-20': [
    { title: 'National Fried Rice Day', desc: 'Feiert gebratenen Reis in vielen Varianten.' },
    { title: 'National String Cheese Day', desc: 'Würdigt den beliebten Käsesnack.' },
    { title: 'Weltkindertag', desc: 'Feiert die Rechte und das Wohl von Kindern.' }
  ],
  '09-21': [
    { title: 'National Pecan Cookie Day', desc: 'Feiert Kekse mit Pekannüssen.' },
    { title: 'National Chai Day', desc: 'Würdigt das würzige Teegetränk.' },
    { title: 'Internationaler Friedenstag', desc: 'UNO-Tag zur Förderung von Frieden weltweit.' }
  ],
  '09-22': [
    { title: 'National Ice Cream Cone Day', desc: 'Feiert die Eiswaffel.' },
    { title: 'National White Chocolate Day', desc: 'Würdigt weiße Schokolade.' },
    { title: 'Autofreier Tag', desc: 'Fördert umweltfreundliche Mobilität.' }
  ],
  '09-23': [
    { title: 'National Great American Pot Pie Day', desc: 'Feiert herzhafte Pasteten.' },
    { title: 'National Snack Stick Day', desc: 'Würdigt Snack-Würstchen für unterwegs.' },
    { title: 'Internationaler Tag der Gebärdensprachen', desc: 'UNO-Tag für Gebärdensprachen und Inklusion.' }
  ],
  '09-24': [
    { title: 'National Cherries Jubilee Day', desc: 'Feiert das Kirschdessert mit flambierter Soße.' },
    { title: 'National Punctuation Day', desc: 'Würdigt Satzzeichen und korrekte Sprache.' },
    { title: 'Welttag der Meere', desc: 'Macht auf den Schutz der Ozeane aufmerksam.' }
  ],
  '09-25': [
    { title: 'National Quesadilla Day', desc: 'Feiert die mexikanische Spezialität.' },
    { title: 'National Comic Book Day', desc: 'Würdigt Comics und ihre Kultur.' },
    { title: 'Welttag der Apotheker', desc: 'Ehrt Apothekerinnen und Apotheker weltweit.' }
  ],
  '09-26': [
    { title: 'National Pancake Day', desc: 'Feiert Pfannkuchen in vielen Varianten.' },
    { title: 'National Dumpling Day', desc: 'Würdigt Teigtaschen aus aller Welt.' },
    { title: 'Europäischer Tag der Sprachen', desc: 'Fördert Mehrsprachigkeit und kulturellen Austausch.' }
  ],
  '09-27': [
    { title: 'National Chocolate Milk Day', desc: 'Feiert Schokoladenmilch als Getränk.' },
    { title: 'National Corned Beef Hash Day', desc: 'Würdigt das traditionelle Kartoffelgericht.' },
    { title: 'Welttourismustag', desc: 'UNO-Tag für nachhaltigen Tourismus.' }
  ],
  '09-28': [
    { title: 'National Strawberry Cream Pie Day', desc: 'Feiert Erdbeer-Sahne-Torte.' },
    { title: 'National Good Neighbor Day', desc: 'Ermutigt zu guter Nachbarschaft.' },
    { title: 'Internationaler Tag des allgemeinen Informationszugangs', desc: 'UNO-Tag für freien Zugang zu Informationen.' }
  ],
  '09-29': [
    { title: 'National Coffee Day', desc: 'Feiert Kaffee und Kaffeekultur.' },
    { title: 'National Biscotti Day', desc: 'Würdigt das italienische Mandelgebäck.' },
    { title: 'Weltherztag', desc: 'Informiert über Herzgesundheit und Prävention.' }
  ],
  '09-30': [
    { title: 'National Hot Mulled Cider Day', desc: 'Feiert heißen Apfelpunsch.' },
    { title: 'National Chewing Gum Day', desc: 'Würdigt Kaugummi und seine Geschichte.' },
    { title: 'Internationaler Übersetzungstag', desc: 'Ehrt Übersetzer und Sprachmittler weltweit.' }
  ],
  '10-01': [
    { title: 'National Homemade Cookies Day', desc: 'Feiert selbstgebackene Kekse.' },
    { title: 'National Hair Day', desc: 'Würdigt Haare und Haarpflege.' },
    { title: 'Internationaler Tag der älteren Menschen', desc: 'UNO-Tag für die Rechte und das Wohl älterer Menschen.' }
  ],
  '10-02': [
    { title: 'National Custodial Worker Day', desc: 'Würdigt Reinigungskräfte und ihre Arbeit.' },
    { title: 'National Fried Scallops Day', desc: 'Feiert frittierte Jakobsmuscheln.' },
    { title: 'Internationaler Tag der Gewaltlosigkeit', desc: 'UNO-Tag zu Ehren von Mahatma Gandhi.' }
  ],
  '10-03': [
    { title: 'National Boyfriend Day', desc: 'Feiert Partnerschaften und Zuneigung.' },
    { title: 'National Techies Day', desc: 'Würdigt Menschen aus der IT und Technik.' },
    { title: 'Tag der Deutschen Einheit', desc: 'Nationalfeiertag Deutschlands.' }
  ],
  '10-04': [
    { title: 'National Taco Day', desc: 'Feiert Tacos in vielen Varianten.' },
    { title: 'National Cinnamon Roll Day', desc: 'Würdigt die Zimtschnecke als Gebäck.' },
    { title: 'Welttierschutztag', desc: 'Fördert den Schutz von Tieren weltweit.' }
  ],
  '10-05': [
    { title: 'National Apple Betty Day', desc: 'Feiert das traditionelle Apfeldessert.' },
    { title: 'National Do Something Nice Day', desc: 'Ermutigt zu freundlichen Gesten.' },
    { title: 'Weltlehrertag', desc: 'UNO-Tag zur Würdigung von Lehrkräften.' }
  ],
  '10-06': [
    { title: 'National Noodle Day', desc: 'Feiert Nudeln aus aller Welt.' },
    { title: 'National Orange Wine Day', desc: 'Würdigt Orange Wine und Weintraditionen.' },
    { title: 'Welttag der Zerebralparese', desc: 'Macht auf Menschen mit Zerebralparese aufmerksam.' }
  ],
  '10-07': [
    { title: 'National Frappe Day', desc: 'Feiert das gekühlte Kaffeegetränk.' },
    { title: 'National Inner Beauty Day', desc: 'Fördert Selbstwert und innere Stärke.' },
    { title: 'Welttag für menschenwürdige Arbeit', desc: 'Setzt sich für faire Arbeitsbedingungen ein.' }
  ],
  '10-08': [
    { title: 'National Fluffernutter Day', desc: 'Feiert das Sandwich mit Erdnussbutter und Marshmallowcreme.' },
    { title: 'National Pierogi Day', desc: 'Würdigt die osteuropäische Teigtasche.' },
    { title: 'Welttag des Sehens', desc: 'Fördert Augengesundheit und Vorsorge.' }
  ],
  '10-09': [
    { title: 'National Moldy Cheese Day', desc: 'Feiert gereiften Käse wie Blauschimmelkäse.' },
    { title: 'National Leif Erikson Day', desc: 'Würdigt den nordischen Entdecker.' },
    { title: 'Weltposttag', desc: 'Feiert die internationale Post und Kommunikation.' }
  ],
  '10-10': [
    { title: 'National Angel Food Cake Day', desc: 'Feiert den luftigen Kuchenklassiker.' },
    { title: 'National Handbag Day', desc: 'Würdigt Handtaschen und Design.' },
    { title: 'Welttag der psychischen Gesundheit', desc: 'Fördert Aufklärung über psychische Gesundheit.' }
  ],
  '10-11': [
    { title: 'National Sausage Pizza Day', desc: 'Feiert Pizza mit Wurstbelag.' },
    { title: 'National Coming Out Day', desc: 'Unterstützt Offenheit und Sichtbarkeit von LGBTQ+-Menschen.' },
    { title: 'Internationaler Mädchentag', desc: 'UNO-Tag für die Rechte und Chancen von Mädchen.' }
  ],
  '10-12': [
    { title: 'National Gumbo Day', desc: 'Feiert den würzigen Eintopf aus Louisiana.' },
    { title: 'National Farmers Day', desc: 'Würdigt Landwirte und ihre Arbeit.' },
    { title: 'Welttag der Arthritis', desc: 'Macht auf Arthritis und Betroffene aufmerksam.' }
  ],
  '10-13': [
    { title: 'National Yorkshire Pudding Day', desc: 'Feiert die britische Beilage aus Teig.' },
    { title: 'National No Bra Day', desc: 'Aktionstag zur Aufmerksamkeit für Brustkrebs.' },
    { title: 'Internationaler Tag für Katastrophenvorsorge', desc: 'UNO-Tag zur Verringerung von Katastrophenrisiken.' }
  ],
  '10-14': [
    { title: 'National Dessert Day', desc: 'Feiert Desserts und süße Speisen.' },
    { title: 'National Real Sugar Day', desc: 'Würdigt Zucker aus natürlichen Quellen.' },
    { title: 'Weltnormentag', desc: 'Macht auf die Bedeutung technischer Standards aufmerksam.' }
  ],
  '10-15': [
    { title: 'National Cheese Curd Day', desc: 'Feiert frischen Käsebruch.' },
    { title: 'National Mushroom Day', desc: 'Würdigt Pilze in Natur und Küche.' },
    { title: 'Internationaler Tag der Frauen in ländlichen Gebieten', desc: 'UNO-Tag für die Rolle von Frauen auf dem Land.' }
  ],
  '10-16': [
    { title: 'National Liqueur Day', desc: 'Feiert Liköre und ihre Vielfalt.' },
    { title: 'National Dictionary Day', desc: 'Würdigt Wörterbücher und Sprache.' },
    { title: 'Welternährungstag', desc: 'UNO-Tag gegen Hunger und Unterernährung.' }
  ],
  '10-17': [
    { title: 'National Pasta Day', desc: 'Feiert Pasta in all ihren Formen.' },
    { title: 'National Edge Day', desc: 'Würdigt alternatives Lebensgefühl und Selbstdisziplin.' },
    { title: 'Internationaler Tag zur Beseitigung der Armut', desc: 'UNO-Tag gegen Armut weltweit.' }
  ],
  '10-18': [
    { title: 'National Chocolate Cupcake Day', desc: 'Feiert Schokoladen-Cupcakes.' },
    { title: 'National No Beard Day', desc: 'Macht auf Krebsaufklärung aufmerksam.' },
    { title: 'Welt-Menopause-Tag', desc: 'Fördert Wissen über die Menopause.' }
  ],
  '10-19': [
    { title: 'National Seafood Bisque Day', desc: 'Feiert die cremige Fisch- und Meeresfrüchtesuppe.' },
    { title: 'National New Friends Day', desc: 'Ermutigt dazu, neue Freundschaften zu schließen.' },
    { title: 'Internationaler Tag gegen Brustkrebs', desc: 'Fördert Früherkennung und Aufklärung.' }
  ],
  '10-20': [
    { title: 'National Brandied Fruit Day', desc: 'Feiert in Alkohol eingelegte Früchte.' },
    { title: 'National Youth Confidence Day', desc: 'Fördert Selbstvertrauen bei jungen Menschen.' },
    { title: 'Weltstatistiktag', desc: 'Würdigt die Bedeutung verlässlicher Daten und Statistiken.' }
  ],
  '10-21': [
    { title: 'National Pumpkin Cheesecake Day', desc: 'Feiert Käsekuchen mit Kürbis.' },
    { title: 'National Reptile Awareness Day', desc: 'Macht auf Reptilien und ihren Schutz aufmerksam.' },
    { title: 'Internationaler Tag der Nachos', desc: 'Würdigt den beliebten Snack aus Mexiko.' }
  ],
  '10-22': [
    { title: 'National Nut Day', desc: 'Feiert Nüsse als gesunden Snack.' },
    { title: 'National Color Day', desc: 'Würdigt Farben und ihre Bedeutung.' },
    { title: 'Internationaler Tag des Stotterns', desc: 'Fördert Verständnis für Menschen mit Stottern.' }
  ],
  '10-23': [
    { title: 'National Boston Cream Pie Day', desc: 'Feiert die berühmte Boston Cream Pie.' },
    { title: 'National iPod Day', desc: 'Erinnert an den Musikplayer von Apple.' },
    { title: 'Mol-Tag', desc: 'Feiert die Naturwissenschaften und Chemie.' }
  ],
  '10-24': [
    { title: 'National Bologna Day', desc: 'Würdigt die Wurstspezialität Bologna.' },
    { title: 'National Food Day', desc: 'Fördert bewusste Ernährung.' },
    { title: 'Tag der Vereinten Nationen', desc: 'Feiert die Gründung der UNO.' }
  ],
  '10-25': [
    { title: 'National Greasy Foods Day', desc: 'Feiert deftige und herzhafte Speisen.' },
    { title: 'National I Care About You Day', desc: 'Ermutigt dazu, Fürsorge zu zeigen.' },
    { title: 'Welttag für Menschen mit Spina bifida und Hydrozephalus', desc: 'Macht auf diese Erkrankungen aufmerksam.' }
  ],
  '10-26': [
    { title: 'National Pumpkin Day', desc: 'Feiert den Kürbis in all seinen Formen.' },
    { title: 'National Mule Day', desc: 'Würdigt Maultiere und ihre Geschichte.' },
    { title: 'Intersex Awareness Day', desc: 'Fördert Sichtbarkeit und Akzeptanz intergeschlechtlicher Menschen.' }
  ],
  '10-27': [
    { title: 'National American Beer Day', desc: 'Feiert amerikanische Brautraditionen.' },
    { title: 'National Black Cat Day', desc: 'Fördert die Adoption schwarzer Katzen.' },
    { title: 'Welttag des audiovisuellen Erbes', desc: 'Würdigt die Bewahrung von Film- und Tonaufnahmen.' }
  ],
  '10-28': [
    { title: 'National Chocolate Day', desc: 'Feiert Schokolade in all ihren Varianten.' },
    { title: 'National First Responders Day', desc: 'Würdigt Rettungs- und Einsatzkräfte.' },
    { title: 'Internationaler Animationsfilmtag', desc: 'Feiert die Kunst der Animation.' }
  ],
  '10-29': [
    { title: 'National Cat Day', desc: 'Feiert Katzen und fördert Tierschutz.' },
    { title: 'National Internet Day', desc: 'Würdigt die Entwicklung des Internets.' },
    { title: 'Weltschlaganfalltag', desc: 'Informiert über Schlaganfall und Prävention.' }
  ],
  '10-30': [
    { title: 'National Candy Corn Day', desc: 'Feiert die traditionelle Halloween-Süßigkeit.' },
    { title: 'National Checklist Day', desc: 'Ermutigt zu Planung und Organisation.' },
    { title: 'Weltspartag', desc: 'Fördert verantwortungsvollen Umgang mit Geld.' }
  ],
  '10-31': [
    { title: 'National Caramel Apple Day', desc: 'Feiert Äpfel mit Karamellüberzug.' },
    { title: 'National Magic Day', desc: 'Würdigt Zauberkunst und Illusionen.' },
    { title: 'Halloween', desc: 'Traditioneller Tag für Kostüme und Süßigkeiten.' }
  ],
  '11-01': [
    { title: 'National Calzone Day', desc: 'Feiert die gefüllte italienische Teigtasche.' },
    { title: 'National Authors\' Day', desc: 'Würdigt Autorinnen und Autoren.' },
    { title: 'Weltvegantag', desc: 'Fördert eine pflanzliche Lebensweise.' }
  ],
  '11-02': [
    { title: 'National Deviled Egg Day', desc: 'Feiert gefüllte Eier als Klassiker.' },
    { title: 'National Ohio Day', desc: 'Würdigt den US-Bundesstaat Ohio.' },
    { title: 'Allerseelen', desc: 'Christlicher Gedenktag für Verstorbene.' }
  ],
  '11-03': [
    { title: 'National Sandwich Day', desc: 'Feiert das belegte Brot in vielen Varianten.' },
    { title: 'National Housewife Day', desc: 'Würdigt Hausarbeit und Familienorganisation.' },
    { title: 'Tag der Kultur in Japan', desc: 'Feiert Kunst, Bildung und Kultur.' }
  ],
  '11-04': [
    { title: 'National Candy Day', desc: 'Feiert Süßigkeiten aller Art.' },
    { title: 'National Chicken Lady Day', desc: 'Würdigt Dr. Marthenia Dupree und ihr Engagement.' },
    { title: 'Internationaler Tag gegen Gewalt und Mobbing in der Schule', desc: 'UNO-Tag für ein sicheres Lernumfeld.' }
  ],
  '11-05': [
    { title: 'National Doughnut Appreciation Day', desc: 'Feiert den beliebten Donut.' },
    { title: 'National Love Your Red Hair Day', desc: 'Würdigt rote Haare und Vielfalt.' },
    { title: 'Welt-Tsunami-Tag', desc: 'Fördert Vorsorge und Aufklärung über Tsunamis.' }
  ],
  '11-06': [
    { title: 'National Nachos Day', desc: 'Feiert den beliebten mexikanischen Snack.' },
    { title: 'National Saxophone Day', desc: 'Würdigt das Saxophon und seine Musik.' },
    { title: 'Internationaler Tag zur Verhütung der Ausbeutung der Umwelt in Kriegen', desc: 'UNO-Tag für Umwelt- und Friedensschutz.' }
  ],
  '11-07': [
    { title: 'National Bittersweet Chocolate with Almonds Day', desc: 'Feiert Schokolade mit Mandeln.' },
    { title: 'National Hug a Bear Day', desc: 'Würdigt Bären und ihren Schutz.' },
    { title: 'Internationaler Tag der Physik in der Medizin', desc: 'Fördert medizinische Physik und Forschung.' }
  ],
  '11-08': [
    { title: 'National Cappuccino Day', desc: 'Feiert den italienischen Kaffeeklassiker.' },
    { title: 'National STEM Day', desc: 'Fördert Interesse an Naturwissenschaft und Technik.' },
    { title: 'Internationaler Tag der Radiologie', desc: 'Würdigt die medizinische Bildgebung.' }
  ],
  '11-09': [
    { title: 'National Scrapple Day', desc: 'Feiert die traditionelle Spezialität aus Pennsylvania.' },
    { title: 'National Louisiana Day', desc: 'Würdigt den US-Bundesstaat Louisiana.' },
    { title: 'Internationaler Tag gegen Faschismus und Antisemitismus', desc: 'Erinnerungs- und Aktionstag gegen Hass und Diskriminierung.' }
  ],
  '11-10': [
    { title: 'National Vanilla Cupcake Day', desc: 'Feiert den Vanille-Cupcake.' },
    { title: 'National Forget-Me-Not Day', desc: 'Erinnert daran, andere nicht zu vergessen.' },
    { title: 'Welttag der Wissenschaft für Frieden und Entwicklung', desc: 'UNO-Tag für Wissenschaft im Dienst der Gesellschaft.' }
  ],
  '11-11': [
    { title: 'National Sundae Day', desc: 'Feiert das Eisdessert mit Toppings.' },
    { title: 'National Origami Day', desc: 'Würdigt die Kunst des Papierfaltens.' },
    { title: 'Martinstag', desc: 'Christlicher Gedenktag des heiligen Martin.' }
  ],
  '11-12': [
    { title: 'National French Dip Day', desc: 'Feiert das warme Sandwich mit Rindfleisch.' },
    { title: 'National Pizza with the Works Except Anchovies Day', desc: 'Würdigt reich belegte Pizza.' },
    { title: 'Welttag gegen Lungenentzündung', desc: 'Macht auf Prävention und Behandlung aufmerksam.' }
  ],
  '11-13': [
    { title: 'National Indian Pudding Day', desc: 'Feiert das traditionelle Dessert aus Maismehl.' },
    { title: 'National World Kindness Day', desc: 'Fördert Freundlichkeit und Mitgefühl.' },
    { title: 'Welttag der Freundlichkeit', desc: 'Ermutigt zu guten Taten im Alltag.' }
  ],
  '11-14': [
    { title: 'National Pickle Day', desc: 'Feiert eingelegte Gurken.' },
    { title: 'National Spicy Guacamole Day', desc: 'Würdigt scharfe Guacamole.' },
    { title: 'Weltdiabetestag', desc: 'Informiert über Diabetes und Prävention.' }
  ],
  '11-15': [
    { title: 'National Bundt Cake Day', desc: 'Feiert den Kranzkuchen.' },
    { title: 'National Clean Out Your Refrigerator Day', desc: 'Ermutigt zum Aufräumen des Kühlschranks.' },
    { title: 'Tag der inhaftierten Schriftsteller', desc: 'Setzt sich für Meinungsfreiheit ein.' }
  ],
  '11-16': [
    { title: 'National Fast Food Day', desc: 'Feiert bekannte Fast-Food-Gerichte.' },
    { title: 'National Button Day', desc: 'Würdigt Knöpfe und ihre Geschichte.' },
    { title: 'Internationaler Tag der Toleranz', desc: 'UNO-Tag für Respekt und Verständnis.' }
  ],
  '11-17': [
    { title: 'National Baklava Day', desc: 'Feiert das süße Blätterteiggebäck.' },
    { title: 'National Take a Hike Day', desc: 'Ermutigt zum Wandern.' },
    { title: 'Internationaler Studententag', desc: 'Würdigt Studierende und Bildung.' }
  ],
  '11-18': [
    { title: 'National Princess Day', desc: 'Feiert Prinzessinnen in Kultur und Geschichten.' },
    { title: 'National Apple Cider Day', desc: 'Würdigt Apfelmost und Apfelgetränke.' },
    { title: 'Europäischer Antibiotikatag', desc: 'Fördert den verantwortungsvollen Einsatz von Antibiotika.' }
  ],
  '11-19': [
    { title: 'National Carbonated Beverage with Caffeine Day', desc: 'Feiert koffeinhaltige Erfrischungsgetränke.' },
    { title: 'National Play Monopoly Day', desc: 'Würdigt das bekannte Brettspiel.' },
    { title: 'Welttoilettentag', desc: 'UNO-Tag für Sanitärversorgung und Hygiene.' }
  ],
  '11-20': [
    { title: 'National Peanut Butter Fudge Day', desc: 'Feiert Erdnussbutter-Fudge.' },
    { title: 'National Absurdity Day', desc: 'Würdigt Humor und Absurditäten.' },
    { title: 'Weltkindertag der Vereinten Nationen', desc: 'Fördert die Rechte und das Wohl von Kindern.' }
  ],
  '11-21': [
    { title: 'National Stuffing Day', desc: 'Feiert die klassische Füllung für Festessen.' },
    { title: 'National Gingerbread Cookie Day', desc: 'Würdigt Lebkuchenkekse.' },
    { title: 'Welttag des Fernsehens', desc: 'UNO-Tag zur Bedeutung des Fernsehens.' }
  ],
  '11-22': [
    { title: 'National Cranberry Relish Day', desc: 'Feiert Cranberry-Soße als Beilage.' },
    { title: 'National Go For a Ride Day', desc: 'Ermutigt zu einem Ausflug oder einer Fahrt.' },
    { title: 'Humane Society Anniversary Day', desc: 'Würdigt den Tierschutz und seine Unterstützer.' }
  ],
  '11-23': [
    { title: 'National Espresso Day', desc: 'Feiert Espresso und Kaffeekultur.' },
    { title: 'National Eat a Cranberry Day', desc: 'Würdigt Cranberries als gesunde Frucht.' },
    { title: 'Fibonacci-Tag', desc: 'Feiert die berühmte Zahlenfolge der Mathematik.' }
  ],
  '11-24': [
    { title: 'National Sardines Day', desc: 'Feiert Sardinen als Speisefisch.' },
    { title: 'National Celebrate Your Unique Talent Day', desc: 'Ermutigt dazu, eigene Talente zu zeigen.' },
    { title: 'Evolutionstag', desc: 'Erinnerungs- und Aktionstag zur Evolutionstheorie.' }
  ],
  '11-25': [
    { title: 'National Parfait Day', desc: 'Feiert das geschichtete Dessert.' },
    { title: 'National Play with Dad Day', desc: 'Würdigt gemeinsame Zeit mit dem Vater.' },
    { title: 'Internationaler Tag gegen Gewalt an Frauen', desc: 'UNO-Tag gegen geschlechtsspezifische Gewalt.' }
  ],
  '11-26': [
    { title: 'National Cake Day', desc: 'Feiert Kuchen in allen Varianten.' },
    { title: 'National Tie One On Day', desc: 'Ermutigt zu Hilfsbereitschaft und Wohltätigkeit.' },
    { title: 'Welttag des Olivenbaums', desc: 'UNO-Tag für Frieden, Kultur und Nachhaltigkeit.' }
  ],
  '11-27': [
    { title: 'National Bavarian Cream Pie Day', desc: 'Feiert die bayerische Cremetorte.' },
    { title: 'National Pins and Needles Day', desc: 'Würdigt Handarbeit und Nähen.' },
    { title: 'Black Friday', desc: 'Traditioneller Start der Weihnachtseinkaufssaison.' }
  ],
  '11-28': [
    { title: 'National French Toast Day', desc: 'Feiert Arme Ritter als Frühstücksgericht.' },
    { title: 'National Red Planet Day', desc: 'Würdigt die Erforschung des Mars.' },
    { title: 'Tag des Schenkens', desc: 'Ermutigt zu Großzügigkeit und Hilfsbereitschaft.' }
  ],
  '11-29': [
    { title: 'National Lemon Cream Pie Day', desc: 'Feiert Zitronencremetorte.' },
    { title: 'National Square Dance Day', desc: 'Würdigt den traditionellen Tanzstil.' },
    { title: 'Internationaler Tag der Solidarität mit dem palästinensischen Volk', desc: 'UNO-Gedenk- und Solidaritätstag.' }
  ],
  '11-30': [
    { title: 'National Mason Jar Day', desc: 'Feiert das klassische Einmachglas.' },
    { title: 'National Personal Space Day', desc: 'Erinnert an die Bedeutung persönlicher Grenzen.' },
    { title: 'Computer Security Day', desc: 'Fördert Bewusstsein für digitale Sicherheit.' }
  ],
  '12-01': [
    { title: 'National Pie Day', desc: 'Feiert Kuchen und Torten in vielen Varianten.' },
    { title: 'National Christmas Lights Day', desc: 'Würdigt festliche Weihnachtsbeleuchtung.' },
    { title: 'Welt-AIDS-Tag', desc: 'Fördert Aufklärung, Prävention und Solidarität.' }
  ],
  '12-02': [
    { title: 'National Fritters Day', desc: 'Feiert süße und herzhafte Teigküchlein.' },
    { title: 'National Mutt Day', desc: 'Würdigt Mischlingshunde und Tierschutz.' },
    { title: 'Internationaler Tag zur Abschaffung der Sklaverei', desc: 'UNO-Tag gegen moderne Formen der Sklaverei.' }
  ],
  '12-03': [
    { title: 'National Roof Over Your Head Day', desc: 'Erinnert an die Bedeutung sicheren Wohnraums.' },
    { title: 'National Green Bean Casserole Day', desc: 'Feiert den traditionellen Auflauf.' },
    { title: 'Internationaler Tag der Menschen mit Behinderungen', desc: 'UNO-Tag für Inklusion und Gleichberechtigung.' }
  ],
  '12-04': [
    { title: 'National Cookie Day', desc: 'Feiert Kekse in allen Variationen.' },
    { title: 'National Dice Day', desc: 'Würdigt Würfel und Gesellschaftsspiele.' },
    { title: 'Internationaler Gepardentag', desc: 'Macht auf den Schutz von Geparden aufmerksam.' }
  ],
  '12-05': [
    { title: 'National Sacher Torte Day', desc: 'Feiert die berühmte Sachertorte.' },
    { title: 'National Bathtub Party Day', desc: 'Ermutigt zu Entspannung und Wellness.' },
    { title: 'Internationaler Tag der Freiwilligen', desc: 'UNO-Tag zur Würdigung ehrenamtlicher Arbeit.' }
  ],
  '12-06': [
    { title: 'National Gazpacho Day', desc: 'Feiert die spanische Kaltsuppe.' },
    { title: 'National Pawnbrokers Day', desc: 'Würdigt das Pfandleihgewerbe.' },
    { title: 'Nikolaustag', desc: 'Traditioneller Tag des heiligen Nikolaus.' }
  ],
  '12-07': [
    { title: 'National Cotton Candy Day', desc: 'Feiert Zuckerwatte als Süßigkeit.' },
    { title: 'National Pearl Harbor Remembrance Day', desc: 'Gedenkt des Angriffs auf Pearl Harbor.' },
    { title: 'Internationaler Tag der Zivilluftfahrt', desc: 'UNO-Tag für die Luftfahrt.' }
  ],
  '12-08': [
    { title: 'National Brownie Day', desc: 'Feiert den Schokoladenkuchen-Klassiker.' },
    { title: 'National Pretend to Be a Time Traveler Day', desc: 'Spielerischer Aktionstag rund ums Zeitreisen.' },
    { title: 'Tag der unbefleckten Empfängnis', desc: 'Christlicher Feiertag in vielen Ländern.' }
  ],
  '12-09': [
    { title: 'National Pastry Day', desc: 'Feiert Gebäck und Backkunst.' },
    { title: 'National Llama Day', desc: 'Würdigt Lamas und ihre Bedeutung.' },
    { title: 'Internationaler Tag gegen Korruption', desc: 'UNO-Tag für Transparenz und Integrität.' }
  ],
  '12-10': [
    { title: 'National Lager Day', desc: 'Feiert untergärige Biersorten.' },
    { title: 'National Dewey Decimal System Day', desc: 'Würdigt Bibliothekssysteme und Wissensorganisation.' },
    { title: 'Tag der Menschenrechte', desc: 'UNO-Tag für die universellen Menschenrechte.' }
  ],
  '12-11': [
    { title: 'National App Day', desc: 'Würdigt mobile Anwendungen und ihre Entwicklung.' },
    { title: 'National Noodle Ring Day', desc: 'Feiert den traditionellen Nudelring.' },
    { title: 'Internationaler Tag der Berge', desc: 'UNO-Tag zum Schutz von Gebirgsregionen.' }
  ],
  '12-12': [
    { title: 'National Ding-a-Ling Day', desc: 'Ermutigt dazu, alte Freunde zu kontaktieren.' },
    { title: 'National Poinsettia Day', desc: 'Würdigt den Weihnachtsstern.' },
    { title: 'Internationaler Tag der allgemeinen Gesundheitsversorgung', desc: 'UNO-Tag für Gesundheitsversorgung für alle.' }
  ],
  '12-13': [
    { title: 'National Cocoa Day', desc: 'Feiert Kakao und heiße Schokolade.' },
    { title: 'National Violin Day', desc: 'Würdigt die Violine und ihre Musik.' },
    { title: 'Tag des Pferdes', desc: 'Feiert die Bedeutung von Pferden für den Menschen.' }
  ],
  '12-14': [
    { title: 'National Bouillabaisse Day', desc: 'Feiert die französische Fischsuppe.' },
    { title: 'National Free Shipping Day', desc: 'Würdigt den kostenlosen Versandhandel.' },
    { title: 'Monkey Day', desc: 'Feiert Affen und den Artenschutz.' }
  ],
  '12-15': [
    { title: 'National Cupcake Day', desc: 'Feiert Cupcakes in vielen Varianten.' },
    { title: 'National Lemon Cupcake Day', desc: 'Würdigt Cupcakes mit Zitronengeschmack.' },
    { title: 'Internationaler Tee-Tag', desc: 'UNO-Tag für Teeanbau und Teekultur.' }
  ],
  '12-16': [
    { title: 'National Chocolate Covered Anything Day', desc: 'Feiert mit Schokolade überzogene Leckereien.' },
    { title: 'National Underdog Day', desc: 'Würdigt Außenseiter und Durchhaltevermögen.' },
    { title: 'Tag der Versöhnung', desc: 'Fördert Frieden und Aussöhnung.' }
  ],
  '12-17': [
    { title: 'National Maple Syrup Day', desc: 'Feiert Ahornsirup als Naturprodukt.' },
    { title: 'National Wright Brothers Day', desc: 'Würdigt die Pioniere des Motorflugs.' },
    { title: 'Internationaler Tag gegen Gewalt an Sexarbeitern', desc: 'Gedenkt Opfern von Gewalt und Diskriminierung.' }
  ],
  '12-18': [
    { title: 'National Roast Suckling Pig Day', desc: 'Feiert Spanferkel als Festgericht.' },
    { title: 'National Twin Day', desc: 'Würdigt Zwillinge und ihre Besonderheiten.' },
    { title: 'Internationaler Tag der Migranten', desc: 'UNO-Tag für die Rechte von Migranten.' }
  ],
  '12-19': [
    { title: 'National Oatmeal Muffin Day', desc: 'Feiert Muffins mit Haferflocken.' },
    { title: 'National Hard Candy Day', desc: 'Würdigt klassische Bonbons.' },
    { title: 'Tag der Erinnerung an die Opfer von Gewalt', desc: 'Gedenkt Betroffenen und ihren Familien.' }
  ],
  '12-20': [
    { title: 'National Sangria Day', desc: 'Feiert das spanische Weingetränk.' },
    { title: 'National Games Day', desc: 'Würdigt Gesellschafts- und Brettspiele.' },
    { title: 'Internationaler Tag der menschlichen Solidarität', desc: 'UNO-Tag für Zusammenhalt und gegenseitige Unterstützung.' }
  ],
  '12-21': [
    { title: 'National French Fried Shrimp Day', desc: 'Feiert frittierte Garnelen als Spezialität.' },
    { title: 'National Crossword Puzzle Day', desc: 'Würdigt Kreuzworträtsel und Denksport.' },
    { title: 'Wintersonnenwende', desc: 'Markiert die längste Nacht des Jahres.' }
  ],
  '12-22': [
    { title: 'National Date Nut Bread Day', desc: 'Feiert Dattel-Nuss-Brot.' },
    { title: 'National Cookie Exchange Day', desc: 'Würdigt das gemeinsame Tauschen von Keksen.' },
    { title: 'Mathematiktag', desc: 'Feiert Mathematik und logisches Denken.' }
  ],
  '12-23': [
    { title: 'National Pfeffernüsse Day', desc: 'Feiert das traditionelle Weihnachtsgebäck.' },
    { title: 'National Roots Day', desc: 'Ermutigt dazu, die eigene Familiengeschichte zu erkunden.' },
    { title: 'Festivus', desc: 'Humorvoller Alternativfeiertag zur Weihnachtszeit.' }
  ],
  '12-24': [
    { title: 'National Eggnog Day', desc: 'Feiert Eierpunsch als Weihnachtsgetränk.' },
    { title: 'National Last-Minute Shopper\'s Day', desc: 'Würdigt spontane Weihnachtseinkäufe.' },
    { title: 'Heiligabend', desc: 'Traditioneller Vorabend des Weihnachtsfestes.' }
  ],
  '12-25': [
    { title: 'National Pumpkin Pie Day', desc: 'Feiert Kürbiskuchen als Festtagsdessert.' },
    { title: 'National Family Day', desc: 'Würdigt gemeinsame Zeit mit der Familie.' },
    { title: 'Weihnachten', desc: 'Christliches Fest zur Geburt Jesu Christi.' }
  ],
  '12-26': [
    { title: 'National Candy Cane Day', desc: 'Feiert die rot-weiße Zuckerstange.' },
    { title: 'National Thank You Note Day', desc: 'Ermutigt dazu, Dankeskarten zu schreiben.' },
    { title: 'Zweiter Weihnachtstag', desc: 'Christlicher Feiertag und Feiertag in vielen Ländern.' }
  ],
  '12-27': [
    { title: 'National Fruitcake Day', desc: 'Feiert den traditionellen Früchtekuchen.' },
    { title: 'National Visit the Zoo Day', desc: 'Ermutigt zu einem Zoobesuch.' },
    { title: 'Internationaler Tag der Epidemievorsorge', desc: 'UNO-Tag zur Vorbereitung auf Epidemien.' }
  ],
  '12-28': [
    { title: 'National Card Playing Day', desc: 'Würdigt Kartenspiele und gemeinsame Spielabende.' },
    { title: 'National Chocolate Candy Day', desc: 'Feiert Schokoladenbonbons.' },
    { title: 'Tag der unschuldigen Kinder', desc: 'Christlicher Gedenktag der Unschuldigen Kinder.' }
  ],
  '12-29': [
    { title: 'National Pepper Pot Day', desc: 'Feiert den traditionellen Eintopf.' },
    { title: 'National Tick Tock Day', desc: 'Ermutigt dazu, Jahresziele abzuschließen.' },
    { title: 'Internationaler Tag der biologischen Vielfalt des Bodens', desc: 'Macht auf die Bedeutung gesunder Böden aufmerksam.' }
  ],
  '12-30': [
    { title: 'National Bacon Day', desc: 'Feiert Speck in vielen Variationen.' },
    { title: 'National Bicarbonate of Soda Day', desc: 'Würdigt Natron und seine Anwendungen.' },
    { title: 'Tag des Kugelschreibers', desc: 'Feiert eines der wichtigsten Schreibwerkzeuge.' }
  ],
  '12-31': [
    { title: 'National Champagne Day', desc: 'Feiert Champagner und festliche Getränke.' },
    { title: 'National Make Up Your Mind Day', desc: 'Ermutigt dazu, Entscheidungen zu treffen.' },
    { title: 'Silvester', desc: 'Letzter Tag des Jahres mit Feiern und Traditionen.' }
  ],
};

function getTodayKey() {
  const now = new Date();
  return String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
}

function getDayEntries() {
  return NATIONAL_DAYS_DATA[getTodayKey()] || null;
}

// ── Widget mit Accordion-Einträgen ────────────────────────────
// Alle 3 Einträge bleiben innerhalb der Card.
// Titel ist klickbar → Beschreibung klappt auf/zu.
// Kein Modal, kein Overflow aus der Card.

function buildWidget(entries) {
  if (document.getElementById('national-day-widget')) return;
  const sidebar = document.getElementById('today-right');
  if (!sidebar) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const widget = document.createElement('div');
  widget.id = 'national-day-widget';
  widget.className = 'national-day-widget';

  // Header
  const header = document.createElement('div');
  header.className = 'national-day-header';
  header.innerHTML = `<span class="national-day-label">Heute ist</span><span class="national-day-date">${dateStr}</span>`;
  widget.appendChild(header);

  // Accordion-Einträge
  const list = document.createElement('div');
  list.className = 'national-day-list';

  entries.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'nd-item' + (idx < entries.length - 1 ? ' nd-item--bordered' : '');

    const titleRow = document.createElement('button');
    titleRow.className = 'nd-title-row';
    titleRow.setAttribute('aria-expanded', 'false');
    titleRow.innerHTML = `
      <span class="nd-arrow">▶</span>
      <span class="nd-title-text">${entry.title}</span>`;

    const descEl = document.createElement('div');
    descEl.className = 'nd-desc';
    descEl.textContent = entry.desc || '';

    titleRow.addEventListener('click', () => {
      const isOpen = item.classList.contains('nd-open');
      // Alle schließen (Accordion)
      list.querySelectorAll('.nd-item').forEach(it => {
        it.classList.remove('nd-open');
        it.querySelector('.nd-title-row').setAttribute('aria-expanded', 'false');
      });
      // Diesen öffnen (wenn vorher zu)
      if (!isOpen) {
        item.classList.add('nd-open');
        titleRow.setAttribute('aria-expanded', 'true');
      }
    });

    item.appendChild(titleRow);
    item.appendChild(descEl);
    list.appendChild(item);
  });

  widget.appendChild(list);
  sidebar.appendChild(widget);
}

// ── Init ──────────────────────────────────────────────────────

function initNationalDay() {
  const entries = getDayEntries();
  if (entries) buildWidget(entries);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNationalDay);
} else {
  initNationalDay();
}

})();
