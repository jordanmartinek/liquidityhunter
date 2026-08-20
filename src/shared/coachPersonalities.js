export const coachPersonalities = {
  stoic_mentor: {
    label: 'Stoic Mentor',
    tagline: 'Discipline is freedom.',
    prefixes: ['Remember:', 'Consider:', 'Reflect:'],
    style: {
      calm: ['Good. You\'re centered. This is where clarity lives.', 'A calm mind sees the market clearly.', 'This presence is your edge.'],
      fomo: ['The market will be here tomorrow. Will your capital?', 'Chasing is the enemy of process.', 'What you miss costs nothing.'],
      revenge: ['Stop. The market owes you nothing.', 'Revenge trading has never worked. Walk away.', 'You cannot trade your way out of tilt.'],
      frustration: ['Frustration means expectations don\'t match reality.', 'The market is indifferent. Your frustration only hurts you.'],
      boredom: ['Boredom is a trap. It leads to manufactured setups.', 'No setup is better than a bad setup.'],
      general: ['Stay present. Trade what you see.', 'Your only job is to follow your rules today.', 'Process. Patience. Precision.'],
    },
  },
  drill_sergeant: {
    label: 'Drill Sergeant',
    tagline: 'No excuses. Execute.',
    prefixes: ['Listen up:', 'Soldier:', 'Focus:'],
    style: {
      calm: ['Good. Head in the game.', 'That\'s the mindset. Maintain it.'],
      fomo: ['You WILL NOT chase. Stand down!', 'That\'s not a setup, that\'s a trap!'],
      revenge: ['STAND DOWN! You are compromised!', 'You are DONE for today. End session NOW.'],
      frustration: ['Feel frustrated? Good. Use it in review, not the next trade.'],
      boredom: ['Bored? GOOD. That means you\'re not forcing garbage trades.'],
      general: ['Check your rules. Follow your plan. No deviation.', 'Discipline isn\'t a suggestion.'],
    },
  },
  sarcastic_friend: {
    label: 'Sarcastic Friend',
    tagline: 'Oh, you again?',
    prefixes: ['Okay listen,', 'Bro.', 'My guy.'],
    style: {
      calm: ['Look at you being all zen. Love that for you.', 'This is the version of you that makes money.'],
      fomo: ['FOMO has never made you money. Just saying.', 'The trade left without you? There\'ll be another in 5 min.'],
      revenge: ['Oh you\'re angry and want to trade bigger? What could go wrong? EVERYTHING.', 'Step. Away. From. The. Keyboard.'],
      frustration: ['Frustrated? Welcome to trading. First time?'],
      boredom: ['Bored = about to do something dumb. I know you.'],
      general: ['You know the rules. Follow them.', 'I believe in you. Mostly. Just follow the rules.'],
    },
  },
};

export const personalityList = Object.entries(coachPersonalities).map(([key, val]) => ({ key, ...val }));
