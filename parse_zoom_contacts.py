import json, re

# ── Raw CSV data keyed by filename ───────────────────────────────────────────
CSV_DATA = {
    "intro_2026_01_14": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-01-14",
        "rows": [
            ("Ann","Kerbel","Djprov@bellsouth.net","approved"),
            ("Alexandra","Skor","Alex.Sharustei@gmail.com","approved"),
            ("Shirli","Tepper","shirlitepper@gmail.com","approved"),
            ("Genevieve","Cadigan","lavive@gmail.com","approved"),
            ("Reina","Hitotoki","mamareina@gmail.com","approved"),
            ("John","Adams","passionnpurpose@gmail.com","approved"),
            ("Brynn","Bishop","Core.empowerment@gmail.com","approved"),
            ("Savannah","Cipriano","savannahcipriano@gmail.com","approved"),
            ("Scott","Gregory","scottrgregory@gmail.com","approved"),
            ("Diego","Galli","em.diesus@gmail.com","approved"),
            ("Samantha","Pestana","Sam@snugglewithsam.com","approved"),
            ("Indigo","Dawn","mxindigodawn@proton.me","approved"),
            ("Joshua","Zader","joshuazader@gmail.com","approved"),
            ("Elena","Arrigo","earrigo5@gmail.com","approved"),
            ("Karin","Leggatt","kleggatt@shaw.ca","approved"),
            ("Dawn","Woodard","dawnwoodard@gmail.com","approved"),
            ("Julia","Grace","Juliagracelmhc@gmail.com","approved"),
            ("M","L","Marou_power@hotmail.com","approved"),
            ("Steven","Libowitz","slibowitz@yahoo.com","approved"),
            ("Joacim","Jonsson","joacimj@gmail.com","approved"),
            ("Oren","Shefer","oren@freelearning.info","approved"),
            ("Daryl","Green","daryl.green1@gmail.com","approved"),
            ("Onawa","Lanier","onawalanier@gmail.com","approved"),
            ("Karam","Kapur","Karkapur@gmail.com","approved"),
            ("Cameron","Grayson","cameron.m.grayson@gmail.com","approved"),
            ("Crystal","Lyons","crissylyons@hotmail.com","approved"),
            ("Lisa","DiMatteo","lisadimatteo@yahoo.com","approved"),
            ("Svetlana","Lilova","lilovasv@gmail.com","approved"),
            ("Bill","White","bill@thehealthycouple.com","approved"),
            ("Mark","S","connection_interplay.linked318@passmail.net","approved"),
            ("Pete","Benedict","petercbenedict@gmail.com","approved"),
            ("Sahil","~","fufstsahil@gmail.com","approved"),
            ("Kristina","Furlan","Kristinafurlan1111@gmail.com","approved"),
            ("Eleanor","Obrien","eleanorlovesyou@gmail.com","approved"),
            ("Emma","Vaillant","emma.vaillant@me.com","approved"),
            ("Darrell","Duane","d@duane.com","approved"),
            ("Miriam","Kubalova","miriam.kubalova@gmail.com","approved"),
            ("Mihai","Banulescu","mihai.banulescu@gmail.com","approved"),
            ("Daniel","Mullins","moachaen@gmail.com","approved"),
            ("Kristin","Kristin Glunt","kristinglunt@gmail.com","approved"),
            ("Laurie","King","lauriesking1991@gmail.com","approved"),
            ("James","B","junkpleaseno@gmail.com","approved"),
            ("Shawn","Lauzon","shawn.lauzon@gmail.com","approved"),
            ("Anezka","Sokol","anezka.sokol@gmail.com","approved"),
            ("David","Demets","david.demets@gmail.com","approved"),
            ("LACI","Lopez","Laci.Lopez@gmail.com","approved"),
            ("Stephanie","Corona","stefcorona@gmail.com","approved"),
            ("Michael","Gabriel","5rhythms.michaelgriffith@gmail.com","approved"),
            ("Crystal","Cavitt","crystaltherapy.cc@gmail.com","approved"),
            ("Stevi","Wilson","Suibst@yahoo.com","approved"),
            ("Melanie","Gold","Gomelaniego@gmail.com","approved"),
            ("Jason","McGarva","jasonmcgarva@gmail.com","approved"),
            ("Golden","Truth","lisakekeroth@gmail.com","approved"),
            ("Taisha","Cortes","taishacortes@gmail.com","approved"),
            ("John","Burkholder","Originalfire269@gmail.com","approved"),
            ("Benjamen","Sprinkle","sprinkleb@gmail.com","approved"),
            ("Rudy","Poe","rudynowhere@gmail.com","approved"),
            ("Timothy","Zook","other@zook.net","approved"),
            ("Gineen","Cooper","gineenlee@icloud.com","approved"),
            ("Laura","Leigh","Laura.Leigh0616@gmail.com","approved"),
            ("Uwe","Karabensch","ufk@gmx.de","approved"),
            ("Agnes","Candiotti","agnes.slowlife@gmail.com","approved"),
            ("Benzi","Holler","benzinow@gmail.com","approved"),
            ("Edyta","W","edyta-w@hotmail.com","approved"),
            ("Dianne","Z","cheenast@gmail.com","approved"),
            ("Satora","Oswald","freesatora@gmail.com","approved"),
            ("Daniel","Ek","daniel.p.ek@gmail.com","approved"),
            ("Felicity","Howell","felicity.howell@gmail.com","approved"),
            ("Sena","Koleva","sena.koleva@gmail.com","approved"),
            ("Tori","King","Vkingmft@gmail.com","approved"),
            ("compasha","aadland","compasha.mama@gmail.com","approved"),
            ("Sandra","Adolf","sandraadolf@gmx.de","approved"),
            ("Conor","Spence","conor.spence+interplay@gmail.com","approved"),
            ("Gregory","Hedler","Hedlerg@chop.edu","approved"),
            ("Ramune","Mickeviciute","Ramune.auguste@gmail.com","approved"),
            ("Glo","Acton","Keisha_acton@hotmail.com","approved"),
            ("Ariel","Goettinger","arielgoettinger@gmail.com","approved"),
            ("Chris","White","alohabliss3@gmail.com","approved"),
            ("Christopher","Scott","Chris.scott971@gmail.com","approved"),
            ("Emily","Bloch","emily.t.bloch@gmail.com","approved"),
            ("Emilee","Wagner","Emilee.wagner33@yahoo.com","approved"),
            ("Violet","Starkey","violetstarkeyhere@gmail.com","approved"),
            ("Tomaz","Kranjc","tkranjc@live.com","approved"),
            ("Mich","C","mikbook@gmail.com","approved"),
            ("Relating Arts","","relatingarts@gmail.com","approved"),  # flag/skip
            ("Nick","Kidd","nskidd2@gmail.com","approved"),
            ("Amr","Thabet","Amr.thabet@maltrak.com","approved"),
        ]
    },
    "intro_2026_01_21": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-01-21",
        "rows": [
            ("Barrie","Cole","Barriehere@gmail.com","approved"),
            ("Logan","Nellis","dynamicrhythmsembodiment@gmail.com","approved"),
            ("Esteban","Olave","eolave13@gmail.com","approved"),
            ("David","Swedlow","dls78731@gmail.com","approved"),
            ("Joann","Lutz","joannlutz22@gmail.com","approved"),
            ("Julie","Ratner","julie@walkaboutwithjulie.com","approved"),
            ("Jamey","Wagner","jameswagner_sb@yahoo.com","approved"),
            ("Kaela","Atleework","findkaela@gmail.com","approved"),
            ("Stephanie","Hagemeister","Stephanie.hagemeister@gmail.com","approved"),
            ("Mahaya","Sikorsky","mahayasham@gmail.com","approved"),
            ("Maheen","Mohammed","maheen@gmail.com","approved"),
            ("Sam","S","samuelspringthorpe@gmail.com","approved"),
            ("Anders","Eriksson","andersomeriksson@gmail.com","approved"),
            ("vicky","leblanc","vll7@hotmail.com","approved"),
            ("Marcus","Walther","Pathways2h@gmail.com","approved"),
            ("Kristy","Wagner","klynn_804@yahoo.com","approved"),
            ("Sandra","Galiwango","srh.026@gmail.com","approved"),
            ("Jen","Green","jengreennd@msn.com","approved"),
            ("Chelsae","Zirna","chelsaez@gmail.com","approved"),
            ("Nova","Lee","novalee@gmail.com","approved"),
            ("Penelope","Goldmuntz","penny.gold@gmail.com","approved"),
            ("Hargobind","Khalsa","hargobind@gmail.com","approved"),
            ("Ana","Parker","parkerdebbie88@gmail.com","approved"),
            ("D","G","Daliush411@gmail.com","approved"),
            ("Andreea","Grad","andreeagrad@gmail.com","approved"),
            ("Elena","Arrigo","earrigo5@gmail.com","approved"),
            ("Daniel","Ek","daniel.p.ek@gmail.com","approved"),
            ("gary","einsidler","geinsidler714@gmail.com","approved"),
            ("Anna","Brunink","anna.bruenink@posteo.de","approved"),
            ("Veronica","Kaulinis","veronica.kaulinis@gmail.com","approved"),
            ("Svetlana","Lilova","lilovasv@gmail.com","approved"),
            ("Samuel","Barnhart","Samabarnhart@gmail.com","approved"),
            ("JJ","Ruescas","JJ@jjruescas.com","approved"),
            ("Ethan","Sawyer","Ethansawyer@gmail.com","approved"),
            ("Joshua","Zader","joshuazader@gmail.com","approved"),
            ("Lisa","DiMatteo","lisadimatteo@yahoo.com","approved"),
            ("Gina","Robinson","pocketrocketsays@gmail.com","approved"),
            ("Adam","J","Adam.jacobowitz@gmail.com","approved"),
            ("Dallas","Broach","broach.dallas@gmail.com","approved"),
            ("Lorena","Renaud","lrenaud.08.16@gmail.com","approved"),
            ("Amanda","Painter","amanda.painter46@gmail.com","approved"),
            ("William","Hooper","billhooper77@gmail.com","approved"),
            ("Rachel","X","Sanctusgermain@proton.me","approved"),
            ("Violet","Starkey","violetstarkeyhere@gmail.com","approved"),
            ("Amy","Curry","Amyleighcurry@gmail.com","approved"),
            ("Max","Efremov","maxim.efremov@gmail.com","approved"),
        ]
    },
    "intro_2026_01_27": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-01-27",
        "rows": [
            ("Chelsae","Zirna","chelsae2992@aol.com","approved"),
            ("Tori","King","Vkingmft@gmail.com","approved"),
            ("Alison","Williams","alimarie@gmail.com","approved"),
            ("Karina","Solomon","Karina@successappeal.com","approved"),
            ("Sri","Mummaneni","sri@abundancehealth.com","approved"),
            ("William","Vaughn","me@wbv.me","approved"),
            ("Ben","Randolph","benrandolph@aol.com","approved"),
            ("Kedar","Shashidhar","kedarshashi@gmail.com","approved"),
            ("Aidan","Fraser","aidanfraser@gmail.com","approved"),
            ("Chris","Page","christopher.z.page@gmail.com","approved"),
            ("kathryn","s","ksuslov@yahoo.com","approved"),
            ("Ariel","DeRuvo","arielderuvo@gmail.com","approved"),
            ("Olivia","Rothschild","Orothsch@gmail.com","approved"),
            ("Candice","Jackson","Cnjackson4@gmail.com","approved"),
            ("Kim","West","kim@sleeplady.com","approved"),
            ("Jeremy","Gildman","jeremy@jeremygildman.com","approved"),
            ("malki","kornwasser","malks.lg@gmail.com","approved"),
            ("Percy Ray","Ballard","pb@percyballardmd.com","approved"),
            ("Anna","Brunink","anna.bruenink@posteo.de","approved"),
            ("Evan","Wong","evanawong@gmail.com","approved"),
            ("Morgan","Klein","morgan.klein@gmail.com","approved"),
            ("Leah","Diamond","leahediamond@gmail.com","approved"),
        ]
    },
    "intro_2026_02_04": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-02-04",
        "rows": [
            ("Tori","King","Vkingmft@gmail.com","approved"),
            ("Ehsan","Falasiri","efalasiri@gmail.com","approved"),
            ("William","Vaughn","me@wbv.me","approved"),
            ("Chrish","Ziran","ziran@zirnig.de","approved"),
            ("Jay","Leonard","jbirdleonard@gmail.com","approved"),
            ("April","Leonard","aprilrene990@gmail.com","approved"),
            ("Lori","Sitko","lsitko@budgetblinds.com","approved"),
            ("Malaika","Hunt","malaika.hunt@camoves.com","approved"),
            ("Christina","Gee","christina@authenticonnection.org","approved"),
            ("Scott","Novis","scott@gametruck.com","approved"),
            ("Sheila","Griffith","Sunnysheila@me.com","approved"),
            ("Holly","Scaglione","calimoon@gmail.com","approved"),
            ("Arne","Drews","arne.drews@posteo.de","approved"),
            ("Adam","Skolnick","a.skolnick53@gmail.com","approved"),
            ("Tiffany","Huntley","tiffany.huntley@yahoo.com","approved"),
            ("Sarah","Stenger","sdstenger@yahoo.com","approved"),
            ('Michelle "Emmy"',"Loiseaux","emmyloiseaux@gmail.com","approved"),
        ]
    },
    "intro_2026_02_13": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-02-13",
        "rows": [
            ("Tyler","Dudden","tyler.dudden@westernalum.org","approved"),
            ("Omer","Saar","omer.personal@gmail.com","approved"),
            ("Phil","Enock","p.enock@gmail.com","approved"),
            ("Sloane","*","sloane@therealsloane.com","approved"),
            ('Michelle "Emmy"',"Loiseaux","emmyloiseaux@gmail.com","approved"),
            ("Joshua","Nunziato","joshua.nunziato@gmail.com","approved"),
            ("Jo","Silver","johanna.s.silver@gmail.com","approved"),
            ("Clover","Haugerud","Cloverswellnessco@gmail.com","approved"),
            ("Katie","Haugerud","Haugerud123@msn.com","approved"),
            ("jonathan","dubin","jonathan.dubin@gmail.com","approved"),
            ("Max","Efremov","maxim.efremov@gmail.com","approved"),
            ("Ziran","Chrish","x@zirnig.de","approved"),
            ("Sunshine","Marositz","Cjheartz487@yahoo.com","approved"),
            ("Angela","Fritzinger","giangie682@gmail.com","approved"),
            ("Monika","Pawluskiewicz","Monika@beyondfitness.life","approved"),
            ("Lee","Rohmann","treelee22@gmail.com","approved"),
            ("Jeff","Doff","jeffdoff@yahoo.com","approved"),
            ("sena","koleva","sena.koleva@gmail.com","approved"),
            ("Mark","Strus","Mstrus@gmail.com","approved"),
            ("Zoom user","","vwbc7y4d22@privaterelay.appleid.com","approved"),  # skip
            ("Scott","Hamilton","synergyself@gmail.com","approved"),
            ("Alison","Williams","alimarie@gmail.com","approved"),
        ]
    },
    "intro_2026_02_27": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-02-27",
        "rows": [
            ("Violet","Starkey","connect@letsinterplay.com","approved"),
            ("Lara","Christine","larastouch@gmail.com","approved"),
            ("Scott","Novis","scott@gametruck.com","approved"),
            ("Gregory","Rickman","gsrickman@gmail.com","approved"),
            ("Bobby","Cardwell","bobby@bobbycardwell.com","approved"),
            ("Beate","Beate","touchintoflow@gmail.com","approved"),
            ("Ehsan","Falasiri","efalasiri@gmail.com","approved"),
            ("Arianna","Macartney","arianna.macartney@gmail.com","approved"),
            ("Adam","Aronovitz","adamaronovitz@gmail.com","approved"),
            ("Nicole","Marie Rose","queenoftherisingroses@gmail.com","approved"),
            ("Teresa","Hooker","teresa@theonebecoming.com","approved"),
            ("Heather","Rudy","h.rudy30@gmail.com","approved"),
            ("Jared","Taylor","jared.ben.taylor@gmail.com","approved"),
            ("Lisa","Flynn","lisamflynn@gmail.com","approved"),
            ("Melanie","Christine","melanadanie@gmail.com","approved"),
            ("Justyna","Janczyszyn","justyna.janczyszyn@gmail.com","approved"),
            ("Rachael","Mare","rachael.ann.mare@gmail.com","approved"),
            ("Sophie","Jacobs","sophie.flowintuit@gmail.com","approved"),
            ("Matthew","Cooke","matthew@matthewtcooke.com","approved"),
            ("Maureen","McNamara","4maureen4@gmail.com","approved"),
            ("Eleanor","O'Brien","eleanor@dancenakedproductions.com","approved"),
            ("Conrad","Poston","conrad@spacestation.life","approved"),
            ("Aaron","Finbloom","aaron.finbloom@gmail.com","approved"),
            ("Jill","Nagle","jillcnagle@gmail.com","approved"),
            ("David","Levine","oaktown.david@gmail.com","approved"),
            ("Mariel","Yag","marielgracey@gmail.com","approved"),
            ("Emmy","Loiseaux","emmyloiseaux@gmail.com","approved"),
            ("Alara","tiernan","alaradirect@gmail.com","approved"),
            ("Alison","Williams","alimarie@gmail.com","approved"),
            ("Leah","Diamond","leahediamond@gmail.com","approved"),
            ("Fuzzy","Shostak","linesarefuzzy@gmail.com","approved"),
            ("sena","koleva","sena.koleva@gmail.com","approved"),
        ]
    },
    "intro_2026_03_18": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-03-18",
        "rows": [
            ("Josten","Lee","jl.fishman@icloud.com","cancelled by self"),
            ("Daniel","Ricciardelli","dbricciardelli@gmail.com","approved"),
            ("Daka","Cliff","daka@thedaka.com","approved"),
            ("William","Vaughn","me@wbv.me","approved"),
            ("Erica","Shapiro","shapiroerica4@gmail.com","approved"),
            ("Drew","McCrary","drew@growthinsightcoaching.com","approved"),
            ("Kiel","Howe","socksogaur@gmail.com","approved"),
            ("Veronica","Kim","veronicayjk@gmail.com","approved"),
            ("Vera","Konstantinova","veraskon@gmail.com","approved"),
            ("Orion","fett","orionfett@gmail.com","approved"),
            ("Rico","Sol","fredericksol88@gmail.com","approved"),
            ("Stephanie","Prescott","stephaniegprescott@gmail.com","approved"),
            ("Sena","Koleva","sena.koleva@gmail.com","approved"),
        ]
    },
    "intro_2026_04_08": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-04-08",
        "rows": [
            ("Rebecca","J Foster","rjfoster6@gmail.com","approved"),
            ("Colin","Beverly","colin.beverly@gmail.com","approved"),
            ("Ava Deborah","Wells","ava.wells.clarity@gmail.com","approved"),
            ("Christina","McFadden","cmoney@gmail.com","cancelled by host"),
            ("Garima","Sharma","garimas5252@gmail.com","approved"),
            ("Alison","Gould","colorsandsounds@gmail.com","approved"),
            ("Kate","Monaghan","kate.m.monaghan@gmail.com","approved"),
            ("Leah","Aitken","lmaitken74@hotmail.com","approved"),
            ("Heather","Rudy","h.rudy30@gmail.com","approved"),
            ("Mike","Anthony","michaelrossanthony@gmail.com","approved"),
            ("Iona","Ross","ionachrisross@gmail.com","approved"),
            ("Sid","Friedman","reflex.plebes_8v@icloud.com","approved"),
            ("Ray","Ray","helloitsraylyn@gmail.com","approved"),
            ("Matt","Ratcliff","mratcliff411@outlook.com","approved"),
            ("David","Tverskoy","davidjtverskoy@gmail.com","approved"),
            ("Davis","Saul","adavissaul@gmail.com","approved"),
            ("Tara","Pelletier","taraepelletier@gmail.com","approved"),
            ("sena","koleva","sena.koleva@gmail.com","approved"),
            ("Tori","King","Vkingmft@gmail.com","approved"),
        ]
    },
    "intro_2026_04_15": {
        "topic": "Intro to Interplay: An Afternoon of Deep Insight",
        "date": "2026-04-15",
        "rows": [
            ("Ava","Deborah Wells","ava.wells.clarity@gmail.com","cancelled by host"),
            ("Kayla","Rodriguez","kayla.unraveled@gmail.com","approved"),
            ("Melissa","Rodriguez","melnau1@gmail.com","approved"),
            ("Jascha","Hoffman","jascha.hoffman@gmail.com","approved"),
            ("Dale","Joyal","dalekjoyal1963@gmail.com","approved"),
            ("Jenny","Mina","jennylm333@gmail.com","approved"),
            ("Christina","McFadden","cmoney@gmail.com","approved"),
        ]
    },
    "deepen_2026_03_27": {
        "topic": "Deepen Your Interplay",
        "date": "2026-03-27",
        "rows": [
            ("Tiffany","Huntley","tiffany.huntley@yahoo.com","approved"),
            ("Frederick","D Sol","rico@easternsuncoaching.com","approved"),
            ("Kiel","Howe","socksogaur@gmail.com","approved"),
            ("Tyler","Tyler","tyler.dudden@westernalum.org","approved"),
            ("Phil","Enock","p.enock@gmail.com","approved"),
            ("Jascha","Hoffman","jascha.hoffman@gmail.com","approved"),
            ("William","Hooper","billhooper77@gmail.com","approved"),
            ("Karam","Kapur","karkapur@gmail.com","approved"),
            ("Rachael","Mare","rachael.ann.mare@gmail.com","approved"),
            ("Rachel","Garst","rachelgarst@gmail.com","approved"),
            ("Veronica","Kim","veronicayjk@gmail.com","approved"),
            ("Lee","Rohmann","treelee22@gmail.com","approved"),
            ("Eleanor","O'Brien","eleanor@dancenakedproductions.com","approved"),
            ("John","Adams","talk.to.johnadams@gmail.com","approved"),
            ("Amr","Thabet","amr.thabet@student.alx.edu.eg","approved"),
            ("kathryn","suslov","ksuslov@yahoo.com","approved"),
            ("Elena","Arrigo","earrigo5@gmail.com","approved"),
            ("Stephanie","Prescott","stephaniegprescott@gmail.com","approved"),
            ("Sena","Koleva","sena.koleva@gmail.com","approved"),
        ]
    },
    "deepen_2026_04_10": {
        "topic": "Deepen Your Interplay",
        "date": "2026-04-10",
        "rows": [
            ("Rachel","Garst","rachelgarst@gmail.com","approved"),
            ("Rico","Sol","rico@returningtosol.com","approved"),
            ("Percy","Ray Ballard","pb@percyballardmd.com","approved"),
            ("Victoria","King","victoriakingmft@gmail.com","approved"),
            ("Lisa","Flynn","lisamflynn@gmail.com","approved"),
            ("Phil","Enock","p.enock@gmail.com","approved"),
            ("Ava","Deborah Wells","ava.wells.clarity@gmail.com","approved"),
            ("William","Hooper","billhooper77@gmail.com","approved"),
            ("Raylyn","DiPaolo","raydipaolo@gmail.com","approved"),
            ("sena","koleva","sena.koleva@gmail.com","approved"),
            ("Karam","Karam","karkapur@gmail.com","approved"),
        ]
    },
    "deepen_2026_04_17": {
        "topic": "Deepen Your Interplay",
        "date": "2026-04-17",
        "rows": [
            ("Rico","Sol","rico@returningtosol.com","approved"),
            ("Dale","Joyal","dalekjoyal1963@gmail.com","approved"),
        ]
    },
    "innerplay_2026_04_07": {
        "topic": "Innerplay: Self Interplay Meditation",
        "date": "2026-04-07",
        "rows": [
            ("Yasmina","Ellins","yasmina.ellins@gmail.com","approved"),
            ("Mark","S","connection_interplay.linked318@passmail.net","approved"),  # skip
            ("Sena","Koleva","sena.koleva@gmail.com","approved"),
            ("MacKenzie","Schuller","mackenzie.schuller@gmail.com","approved"),
            ("Guy","Ganani","guyganani@gmail.com","approved"),
            ("Heather","Rudy","h.rudy30@gmail.com","approved"),
            ("Teresa","Hooker","drteresah@gmail.com","approved"),
            ("Percy Ray","Ballard","pb@percyballardmd.com","approved"),
            ("Julia","Rubin","juliaru@protonmail.com","approved"),
            ("C","Phenix","cphenix@telusplanet.net","approved"),
            ("Ashanta","Lipari","Ashantalipari@gmail.com","approved"),
            ("Daniel","Moreh","dmoreh@gmail.com","approved"),
            ("E","P","erin@mindfixgroup.com","approved"),
            ("joel","packard","acujoel@gmail.com","approved"),
            ("Anders","Eriksson","andersomeriksson@gmail.com","approved"),
            ("Jeanette","Green","jgreen5374@gmail.com","approved"),
            ("Fei","Wyatt","hugsfromfei@gmail.com","approved"),
            ("Phil","Enock","p.enock@gmail.com","approved"),
            ("Yasmina Ellins","","yasminarte@yahoo.co.uk","approved"),
            ("Meridian","Brady","meridianbtherapy@gmail.com","approved"),
            ("maren","ohaks","mareneom@gmail.com","approved"),
            ("Aidan","Fraser","aidanfraser@gmail.com","approved"),
            ("Vee","Bartholomew","veebeesexcoach@gmail.com","approved"),
            ("Elena","Arrigo","earrigo5@gmail.com","approved"),
            ("Natalia","Alvarez Brown","nataliaalvarezbrown@gmail.com","approved"),
            ("William","Hooper","billhooper77@gmail.com","approved"),
            ("Christine Ginger","Fransen","christinefransen8@gmail.com","approved"),
            ("Suvi","J","ttuikku@hotmail.com","approved"),
            ("Polina","Glezer","polina.glezer@gmail.com","approved"),
            ("Ray","DiPaolo","raydipaolo@gmail.com","approved"),
            ("Nick","Hayes","nhayes559@gmail.com","approved"),
        ]
    },
}

# ── Skip rules ───────────────────────────────────────────────────────────────
SKIP_EMAILS = {
    "relatingarts@gmail.com",       # org account - flag for review
    "sena.koleva@gmail.com",        # team - already in system
}
SKIP_STATUSES = {"cancelled by self", "cancelled by host", "denied"}

def should_skip(email, status, first, last):
    el = email.lower().strip()
    if not el:
        return True, "empty email"
    if "privaterelay.appleid.com" in el:
        return True, "private relay"
    if "passmail.net" in el:
        return True, "passmail relay"
    if el in SKIP_EMAILS:
        return True, f"skip: {el}"
    if status.lower().strip() in SKIP_STATUSES:
        return True, f"status: {status}"
    return False, None

# ── Tag logic ─────────────────────────────────────────────────────────────────
TOPIC_TAGS = {
    "Intro to Interplay: An Afternoon of Deep Insight": ["HIST: Online Intro Event"],
    "Deepen Your Interplay": ["HIST: Deepen Your Interplay"],
    "Innerplay: Self Interplay Meditation": ["HIST: Innerplay Meditation", "EVENT TYPE: Webinar [Free]"],
}

UNIVERSAL_TAGS = ["HIST: RI Community", "EVENT TYPE: Online", "HUB: Online"]

# Special handling
TEAM_EMAILS = {"connect@letsinterplay.com"}  # Violet's org email

def build_name(first, last):
    first = first.strip().strip('"').strip()
    last = last.strip().strip('"').strip()
    # Clean up weird chars
    last = last.replace('"Emmy"', 'Emmy').strip()
    full = f"{first} {last}".strip()
    parts = full.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""

# ── Parse all events ──────────────────────────────────────────────────────────
contacts = {}  # email.lower() -> dict
skipped = []
flagged = []

for event_key, event in CSV_DATA.items():
    topic = event["topic"]
    date = event["date"]
    topic_tags = TOPIC_TAGS.get(topic, [])

    for row in event["rows"]:
        first, last, email_raw, status = row
        email = email_raw.lower().strip()

        # Special flag
        if email == "relatingarts@gmail.com":
            flagged.append({"email": email, "name": f"{first} {last}", "reason": "org account - needs human review"})
            continue

        skip, reason = should_skip(email, status, first, last)
        if skip:
            skipped.append({"email": email, "name": f"{first} {last}", "reason": reason, "event": event_key})
            continue

        first_name, last_name = build_name(first, last)

        tags = set(UNIVERSAL_TAGS + topic_tags)

        # Team tag for org email
        if email in TEAM_EMAILS:
            tags.add("TEAM: Facilitator")

        if email in contacts:
            contacts[email]["tags"].update(tags)
            # Prefer longer name
            current = contacts[email]["first_name"] + " " + contacts[email]["last_name"]
            if len(f"{first_name} {last_name}") > len(current.strip()):
                contacts[email]["first_name"] = first_name
                contacts[email]["last_name"] = last_name
        else:
            contacts[email] = {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "tags": tags,
            }

# ── Output summary ─────────────────────────────────────────────────────────────
contact_list = [
    {
        "email": c["email"],
        "first_name": c["first_name"],
        "last_name": c["last_name"],
        "tags": sorted(list(c["tags"])),
    }
    for c in contacts.values()
]

print(f"Total unique importable contacts: {len(contact_list)}")
print(f"Skipped: {len(skipped)}")
print(f"Flagged for review: {len(flagged)}")
print()
print("=== SKIPPED ===")
for s in skipped:
    print(f"  [{s['event']}] {s['name']} <{s['email']}> — {s['reason']}")
print()
print("=== FLAGGED FOR REVIEW ===")
for f in flagged:
    print(f"  {f['name']} <{f['email']}> — {f['reason']}")
print()
print("=== SAMPLE (first 10) ===")
for c in contact_list[:10]:
    print(f"  {c['first_name']} {c['last_name']} <{c['email']}> → {c['tags']}")

# Save
with open("/home/user/claude-code/zoom_contacts.json", "w") as f:
    json.dump(contact_list, f, indent=2)

# Create batches
for i in range(0, len(contact_list), 50):
    batch_num = i // 50 + 1
    batch = contact_list[i:i+50]
    formatted = [
        {"email": c["email"], "first_name": c["first_name"], "last_name": c["last_name"],
         "tags": c["tags"], "subscribe": [{"listid": 3}]}
        for c in batch
    ]
    with open(f"/home/user/claude-code/zoom_batch_{batch_num}.json", "w") as f:
        json.dump(formatted, f)

print(f"\nBatches created: {(len(contact_list)-1)//50 + 1}")
for i in range(0, len(contact_list), 50):
    bn = i // 50 + 1
    print(f"  zoom_batch_{bn}.json: {len(contact_list[i:i+50])} contacts")

