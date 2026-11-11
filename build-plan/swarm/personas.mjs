// Builds the swarm's personas. The same cohort and seed always produce the same
// personas, so runs are repeatable. Agents get a goal and a patience limit
// (budget, in steps), never a click path. Signing up takes about 12 steps, so
// limits leave room for the goal itself: the swarm should measure real friction,
// not run out of steps.

// Never reuse a seed author's first name (Priya, Marco, Lena, Sam, Aisha, Tom, Kenji, Nora):
// an agent called Kenji may think the seed author Kenji's skill is its own.
const FIRST = ['Nadia', 'Pablo', 'Freya', 'Hugo', 'Leila', 'Oscar', 'Wen', 'Dara', 'Ravi', 'Eva',
  'Diego', 'Mei', 'Omar', 'Zoe', 'Ivan', 'Sara', 'Luca', 'Ana', 'Ben', 'Hana', 'Yusuf', 'Chloe',
  'Arjun', 'Mila', 'Felix', 'Ines', 'Kofi', 'Rosa', 'Jin', 'Tara'];

// The last three topics have no seed skill on purpose: real users search for things
// that don't exist yet, which produces zero-result searches.
const TOPICS = ['code review', 'Jest tests', 'slow SQL queries', 'commit messages', 'Docker setup',
  'Next.js authentication', 'React performance', 'API documentation', 'Python type hints',
  'security headers', 'Terraform modules', 'accessibility audits', 'Rust error handling'];

const SHARED_SLUGS = ['nextjs-auth-review', 'code-review-buddy', 'sql-query-tuner',
  'commit-message-writer', 'react-perf-audit'];

// Friends share a skill because they know you need it, so each shared-link visitor
// has the need that matches the skill they're sent. They still decide whether it's good.
const SHARED_NEEDS = {
  'nextjs-auth-review': 'checking the authentication in your Next.js app',
  'code-review-buddy': 'getting better reviews on your pull requests',
  'sql-query-tuner': 'speeding up some slow SQL queries',
  'commit-message-writer': 'writing clearer commit messages',
  'react-perf-audit': 'making a slow React app faster',
};

const SOURCES = ['youtube', 'newsletter', 'x', 'direct'];

// Share of each persona type in a cohort.
const MIX = [['consumer', 0.40], ['builder', 0.25], ['curator', 0.15], ['mobile', 0.15], ['lurker', 0.05]];

export const TEST_CARD = {
  number: '4242 4242 4242 4242',
  expiry: '12/34',
  cvc: '123',
  zip: '10001',
};

// Small deterministic random number generator.
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function split(n) {
  const raw = MIX.map(([type, share]) => ({ type, exact: share * n, count: Math.floor(share * n) }));
  let left = n - raw.reduce((a, r) => a + r.count, 0);
  [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1)).forEach((r) => {
    if (left > 0) { r.count++; left--; }
  });
  return raw;
}

function password(rand) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 14; i++) p += chars[Math.floor(rand() * chars.length)];
  return `${p}#7`;
}

function draft(topic, name) {
  const title = `${topic[0].toUpperCase()}${topic.slice(1)} helper`;
  return {
    title,
    description: `A step-by-step skill that helps an agent with ${topic}.`,
    stack: 'Any',
    tags: topic.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 2).join(', '),
    content: `# ${title}\n\nUse this skill when someone asks for help with ${topic}.\n\n## Steps\n1. Ask what they are working on.\n2. Check the common mistakes for ${topic}.\n3. Suggest concrete fixes with short examples.\n\nWritten by ${name}.`,
  };
}

export function buildPersonas({ n, cohort, seed = 42 }) {
  const rand = seeded(seed * 31 + cohort.charCodeAt(0));
  const list = [];
  let builders = 0;
  let consumers = 0;

  for (const { type, count } of split(n)) {
    for (let k = 0; k < count; k++) {
      const i = list.length;
      const id = String(i + 1).padStart(3, '0');
      const name = FIRST[i % FIRST.length];
      const topic = TOPICS[Math.floor(rand() * TOPICS.length)];
      const c = cohort.toLowerCase();
      const p = {
        id,
        cohort,
        type,
        variant: type,
        name,
        username: `${name.toLowerCase()}-${c}${id}`,
        email: `agent-${c}-${id}+clerk_test@example.com`,
        password: password(rand),
        source: SOURCES[i % SOURCES.length],
        topic,
        mobile: type === 'mobile',
        startPath: '/',
        canPay: false,
        draft: null,
        budget: 16,
        goal: '',
        success: '',
      };

      if (type === 'consumer') {
        if (consumers % 10 === 0) {
          // Rotate through the shared skills (every tenth consumer is a shared-link visitor).
          const slug = SHARED_SLUGS[(consumers / 10) % SHARED_SLUGS.length];
          p.variant = 'consumer-shared';
          p.startPath = `/s/${slug}?ref=share`;
          p.sharedSlug = slug;
          p.goal = `You're working on ${SHARED_NEEDS[slug]}. A friend who knows that shared this skill with you. Decide whether it is useful to you, and install it if it is.`;
          p.success = 'install-shared';
        } else {
          p.goal = `Find a skill that helps with ${topic} and install it. You have never used Hive before.`;
          p.success = 'install';
        }
        p.budget = 30;
        consumers++;
      }

      if (type === 'builder') {
        p.draft = draft(topic, name);
        if (builders % 5 === 0) {
          p.variant = 'builder-private';
          p.canPay = true;
          p.budget = 50;
          p.goal = `Publish your own skill about ${topic} on Hive, but keep it private so only you can see it. If Hive asks you to pay for that, decide like a real developer would: pay only if it seems worth $8 a month to you. Use the draft below.`;
          p.success = 'publish-private';
        } else if (builders % 5 === 1) {
          p.variant = 'builder-team';
          p.canPay = true;
          p.budget = 60;
          p.team = `${name}'s Studio`;
          p.goal = `Your company wants a private skill about ${topic} for its team. Create a team on Hive named "${name}'s Studio", then publish the skill privately for that team. Pay for a team plan only if it seems worth it. Use the draft below.`;
          p.success = 'publish-team';
        } else {
          p.budget = 36;
          p.goal = `Publish your own skill about ${topic} on Hive so other developers can use it. Use the draft below.`;
          p.success = 'publish';
        }
        builders++;
      }

      if (type === 'curator') {
        p.budget = 30;
        // Each curator has their own interest, like consumers do. Without one, every curator
        // (all run by the same model) picks the same "obvious" skill: a simulation artifact.
        p.goal = `You care about ${topic}. Browse the skills, star one you would genuinely use, and leave a short, helpful comment on it.`;
        p.success = 'comment';
      }

      if (type === 'mobile') {
        p.budget = 20;
        p.goal = `On your phone, quickly find a skill for ${topic} and install it. You are impatient: leave if it feels slow or confusing.`;
        p.success = 'install';
      }

      if (type === 'lurker') {
        p.budget = 8;
        p.goal = 'Have a quick look at what Hive is and read about one skill, then leave.';
        p.success = 'view-skill';
      }

      list.push(p);
    }
  }
  return list;
}

// The return wave: about half of a cohort's agents come back a few days later.
export function returnWave(personas) {
  return personas.filter((_, i) => i % 2 === 0).map((p) => ({
    ...p,
    variant: `${p.variant}-return`,
    startPath: '/dashboard',
    budget: 14,
    canPay: false,
    goal: 'You signed up on Hive a few days ago. See what happened to your skills and react to anything interesting.',
    success: 'return-visit',
  }));
}
