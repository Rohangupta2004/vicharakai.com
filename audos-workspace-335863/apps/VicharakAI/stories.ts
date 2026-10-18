/**
 * Story of the Day — real, verified stories about famous people, written for
 * students in the middle of an exam grind.
 *
 * Every entry is about a globally or nationally recognised figure and sticks
 * to documented events — no fictional characters, no invented narratives.
 * Each story is 150–200 words and is chosen for its direct relevance to a
 * study journey: failure before success, consistency, resilience, self-study,
 * late bloomers. One story rotates per day and opens from the Dashboard tab.
 */

export type StoryCategory = 'Scientist' | 'Athlete' | 'Entrepreneur' | 'Leader' | 'Artist';

export interface FamousStory {
  id: string;
  /** Full name of the real person the story is about. */
  name: string;
  /** Short hook line, e.g. "The man who failed 10,000 times". */
  title: string;
  /** 150–200 words — factual, inspiring, exam-prep relevant. */
  story: string;
  category: StoryCategory;
  /** Emoji for the card thumbnail. */
  emoji: string;
}

export const STORIES: FamousStory[] = [
  {
    id: 'apj-abdul-kalam',
    name: 'APJ Abdul Kalam',
    title: 'The pilot who missed the cockpit and reached the stars',
    story:
      "As a boy in Rameswaram, Abdul Kalam woke before dawn to distribute newspapers so his family could get by, then went to school. His dream was to fly fighter planes. At the Air Force selection board in Dehradun he finished ninth — and there were only eight seats. The dream he had carried for years ended in one list on one noticeboard. He didn't stop studying. He joined India's fledgling aerospace effort instead, and as project director of SLV-3 he lived through a launch failure in 1979 before putting the Rohini satellite into orbit in 1980. He went on to lead India's missile programme, became known as the Missile Man, and in 2002 became President of India — a president who kept teaching students until his last day. The exam that rejects you is not the final word on you. Kalam's ninth place is proof that a closed door can redirect you to work that matters even more than the dream you lost.",
    category: 'Scientist',
    emoji: '\uD83D\uDE80',
  },
  {
    id: 'albert-einstein',
    name: 'Albert Einstein',
    title: "The 'slow' child who rewrote physics",
    story:
      "Einstein spoke so late as a child that his family worried, and some teachers considered him slow and absent-minded. At sixteen he sat the entrance exam for the Zurich Polytechnic — and failed it. His physics and mathematics scores were brilliant, but the general sections pulled him down, and he had to spend a year at a Swiss school repairing his gaps before he was admitted. After graduating, he couldn't land a single academic post; he marked time as a clerk in the Bern patent office, examining other people's inventions. But he protected a habit no rejection could touch: thinking about physics every single day, in the gaps around his job. In 1905, still a patent clerk, he published four papers — including special relativity — that changed science forever. The Nobel Prize came in 1921. A failed entrance exam did not measure what Einstein was capable of. It measured one day's paper. He filled his gaps, kept working daily, and let time do the rest.",
    category: 'Scientist',
    emoji: '\uD83E\uDDE0',
  },
  {
    id: 'sachin-tendulkar',
    name: 'Sachin Tendulkar',
    title: 'Rejected as a bowler, remembered as a batting god',
    story:
      "At fourteen, Sachin Tendulkar travelled to the MRF Pace Foundation dreaming of becoming a fast bowler. The legendary Dennis Lillee looked at him and was unimpressed — he was told to focus on his batting instead. Sachin went back to his coach Ramakant Achrekar's relentless routine: multiple net sessions a day, and the famous one-rupee coin placed on his stumps that he could keep only if no bowler dismissed him through an entire session. He made his India debut at sixteen against one of the world's most fearsome pace attacks, scored just 15, and cried that night. In a later match a Waqar Younis bouncer bloodied his nose — he waved off help and kept batting. That combination — accept the redirection, then out-practise everyone — carried him through a 24-year career to 100 international centuries, a record nobody has touched. Your first rejection might simply be pointing you at your real strength. What you do every single day after that is what the world eventually sees.",
    category: 'Athlete',
    emoji: '\uD83C\uDFCF',
  },
  {
    id: 'jk-rowling',
    name: 'J.K. Rowling',
    title: 'Twelve rejections and a boy wizard',
    story:
      "The idea for Harry Potter arrived while Joanne Rowling sat on a delayed train from Manchester to London in 1990. What followed was the hardest stretch of her life: her mother died, her marriage ended, and she found herself in Edinburgh as a single mother living on state benefits, by her own description 'as poor as it is possible to be in modern Britain without being homeless.' She wrote anyway — in cafés while her baby daughter slept in the pram beside her, finishing the manuscript in stolen hours. Twelve publishers rejected it. Bloomsbury finally said yes, largely because the chairman's eight-year-old daughter read the first chapter and demanded more — and even then Rowling was advised to keep a day job, since children's books rarely paid. The series went on to sell more than 500 million copies. Twelve people whose whole job was judging books got it wrong. Rejection is one person's opinion on one day — it is not a verdict on your work, and never a reason to stop.",
    category: 'Artist',
    emoji: '\u270D\uFE0F',
  },
  {
    id: 'thomas-edison',
    name: 'Thomas Edison',
    title: 'The man who found 10,000 ways that did not work',
    story:
      "Edison's schoolteacher called him 'addled', and his formal schooling lasted only a few months — his mother taught him at home, and he educated himself in libraries while selling newspapers on trains. He grew almost completely deaf, and later called it an advantage: it made it easier to concentrate. Perfecting the incandescent lightbulb meant testing thousands of materials for a workable filament — carbonised thread, bamboo, thousands of plant fibres — failure after failure, logged in meticulous notebooks. Asked about all those failed experiments, he reportedly replied that he hadn't failed at all: he had successfully found thousands of ways that would not work. That reframe was his method — every dead end was data that narrowed the search. He died holding 1,093 US patents. Treat your mock tests exactly the way Edison treated his experiments. A wrong answer isn't a humiliation; it's a documented way that doesn't work, which is one step closer to the way that does. Log it, learn it, run the next test.",
    category: 'Scientist',
    emoji: '\uD83D\uDCA1',
  },
  {
    id: 'nelson-mandela',
    name: 'Nelson Mandela',
    title: 'The student of cell block B',
    story:
      "Nelson Mandela spent 27 years in prison, most of them on Robben Island — breaking rocks in a limestone quarry by day, held in a tiny cell by night. He refused to let prison end his education. He enrolled by correspondence with the University of London and studied law from his cell, with study privileges that guards could and sometimes did revoke as punishment. He kept going for decades, and finally completed his law degree through the University of South Africa in 1989, at the age of seventy, shortly before his release. Around him, the prisoners built what they called 'Mandela University' — inmates secretly teaching each other whatever each one knew, sometimes writing lessons in the sand of the quarry. Five years after walking free, he was President of South Africa. He later said that education is the most powerful weapon you can use to change the world — and he had tested that belief in the hardest classroom on earth. Whatever your circumstances are today, they are better than a cell. Study anyway. He did.",
    category: 'Leader',
    emoji: '\u270A',
  },
  {
    id: 'sundar-pichai',
    name: 'Sundar Pichai',
    title: "From a two-room Chennai flat to Google's corner office",
    story:
      "Sundar Pichai grew up in a modest two-room apartment in Chennai, sleeping on the living-room floor with his younger brother. The family had no car and no television; their first telephone — a rotary dial — arrived when he was about twelve, and neighbours would come over to use it. What he had was an unusual discipline of mind: he could recall every number he had ever dialled, and he studied with a steadiness that never depended on mood or equipment. That consistency took him to IIT Kharagpur, where he earned a silver medal in metallurgical engineering, and then a scholarship to Stanford — the plane ticket to America cost more than his father's annual salary, and the family spent from their savings to send him. In 2015 he became CEO of Google, and in 2019 CEO of Alphabet itself. He had no shortcuts, no connections and no gadgets — only daily, unglamorous consistency. That is the one advantage that is fully available to you, today, for free.",
    category: 'Entrepreneur',
    emoji: '\uD83D\uDCBB',
  },
  {
    id: 'marie-curie',
    name: 'Marie Curie',
    title: 'She studied in secret before she made history',
    story:
      "In Russian-ruled Poland, women were barred from the University of Warsaw. So Marie Curie studied anyway — at the clandestine 'Flying University', an illegal night school that changed locations to dodge the authorities. To fund her sister Bronya's medical studies in Paris, she worked for years as a governess, studying alone after the children slept, under a pact that Bronya would fund her turn next. She reached the Sorbonne at 24, older than her classmates and behind in French and mathematics. She lived in an unheated garret, sometimes fainting from hunger while she studied, and finished first in her physics degree anyway. In 1903 she became the first woman ever to win a Nobel Prize; in 1911 she won a second, in chemistry — the first person of any gender to win two. Every obstacle you can name — no permission, no money, no time, starting late — she had a worse version of it. She out-studied all of them, in secret, one night at a time.",
    category: 'Scientist',
    emoji: '\uD83D\uDD2C',
  },
  {
    id: 'dhirubhai-ambani',
    name: 'Dhirubhai Ambani',
    title: 'The petrol-pump attendant who built an empire',
    story:
      "Dhirubhai Ambani was a village schoolteacher's son from Chorwad, Gujarat, and never earned a college degree. At sixteen he sailed to Aden in Yemen, where he started as a clerk and petrol-pump attendant with A. Besse & Co., which distributed Shell products. His real education happened after hours: he hung around the port and the souks studying how traders priced goods, how money moved, how margins worked — treating the marketplace itself as his university and filling the gap where a classroom should have been. He returned to India in 1958 and started Reliance from a small rented office, trading spices and later yarn, working relentlessly while established players dismissed him. That trading firm became Reliance Industries, one of India's largest companies, and Dhirubhai became the man who brought share ownership to millions of ordinary Indian families. A degree is one route to knowledge, but it is not the only one — and it is never the ceiling. Curiosity plus daily observation, compounded for years, built what no certificate could.",
    category: 'Entrepreneur',
    emoji: '\uD83C\uDFED',
  },
  {
    id: 'oprah-winfrey',
    name: 'Oprah Winfrey',
    title: 'Fired from the news, then she changed television',
    story:
      "Oprah Winfrey was born into deep poverty in rural Mississippi to a teenage single mother — as a child she wore dresses made from potato sacks and was mocked for it. Her escape route was words: she won a full scholarship to Tennessee State University through public speaking. Her early career then stumbled exactly where she seemed strongest. As a young co-anchor of the Baltimore evening news she was pulled off the desk — told, in effect, that she was wrong for television news — and shunted to a low-profile morning slot. In 1984 she took over a struggling Chicago morning programme called AM Chicago, dead last in its market. Within months she made it number one; it became The Oprah Winfrey Show, ran for 25 seasons, and made her the most influential media personality of her era and a self-made billionaire. The role she 'failed' at was simply the wrong stage for her strengths. A bad result is not always a verdict — sometimes it is a redirection to the arena where you win.",
    category: 'Entrepreneur',
    emoji: '\uD83C\uDFA4',
  },
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    title: 'The 12-year-old who taught himself to code',
    story:
      "Growing up in Pretoria, South Africa, Elon Musk was a bookish boy who was bullied badly at school — once beaten so severely he needed hospital care. Books were his refuge; he is said to have read the Encyclopaedia Britannica for fun after finishing the library's science fiction shelf. Around age ten he got a Commodore VIC-20 home computer. It came with a BASIC programming workbook meant to take six months; with no teacher, no course and no internet, he worked through it obsessively in a few days. At twelve he wrote a space game called Blastar and sold the code to a computer magazine for about 500 dollars — a schoolboy earning from a skill no school had given him. He used the same method as an adult, reading rocketry textbooks to teach himself the fundamentals before founding SpaceX. The syllabus in front of you is far more structured than a 1980s computer manual. If a twelve-year-old could self-teach with less, your self-study hours count for more than you think.",
    category: 'Entrepreneur',
    emoji: '\u26A1',
  },
  {
    id: 'viswanathan-anand',
    name: 'Viswanathan Anand',
    title: 'The quiet kid from Chennai who outworked the world',
    story:
      "Viswanathan Anand learned chess at six, taught by his mother Susheela at their home in Chennai. When his father's job took the family to Manila, his mother turned a daily TV chess programme into his training ground — recording the puzzles while he was at school so he could solve them every evening, and posting in his answers, which kept winning the show's prizes. Back in India, his routine was unglamorous consistency: weekend after weekend of local tournaments, year after year, while his speed earned him the nickname 'Lightning Kid'. In 1988, at eighteen, he became India's first chess grandmaster — in a country with almost no chess infrastructure at the time. He went on to become five-time World Champion, winning the title in every format the game offers. And when he lost his crown in 2013 and critics called him finished, he won the 2014 Candidates tournament at 44 to earn his rematch. No single brilliant day built that career. Thousands of ordinary, repeated ones did. That option is open to you tonight.",
    category: 'Athlete',
    emoji: '\u265F\uFE0F',
  },
];

/**
 * One story per day, rotating deterministically, so opening the app twice in a
 * day shows the same story and tomorrow brings a new one.
 */
export function storyOfTheDay(dateISO: string): FamousStory {
  let hash = 0;
  for (let i = 0; i < dateISO.length; i += 1) {
    hash = (hash * 33 + dateISO.charCodeAt(i)) >>> 0;
  }
  return STORIES[hash % STORIES.length];
}
