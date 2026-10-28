export type Ability = {
  name: string;
  cost: number;
  ultimate?: boolean;
  difficulty?: string;
  text: string;
};

export type Sorcerer = {
  name: string;
  element: string;
  image: string;
  style: string;
  hp: number;
  passive: { name: string; text: string };
  abilities: Ability[];
  strongAgainst: string;
  weakAgainst: string;
};

export const sorcerers: Sorcerer[] = [
  {
    name: "Brom",
    element: "Earth",
    image: "/assets/arcade/brom.svg",
    style: "Tank and control",
    hp: 220,
    passive: {
      name: "Bedrock Aegis",
      text: "Starts with a 25 point stone Ward that grows back by 10 every turn he isn't hit. Stone isn't magic, so Deluge can't wash it away.",
    },
    abilities: [
      {
        name: "Rock Spike",
        cost: 1,
        difficulty: "Medium",
        text: "A spike shoots up from the ground for 32 damage. It can only be avoided by jumping.",
      },
      {
        name: "Quake",
        cost: 3,
        difficulty: "Medium",
        text: "Shakes the ground for 45 damage and Roots the target, so they can't dodge next turn. Brom also gains 15 Ward. Jump to avoid it.",
      },
      {
        name: "Mountain's Wrath",
        cost: 5,
        ultimate: true,
        difficulty: "Easy dodge, hard parry",
        text: "One huge 85 damage slam with a long wind-up and a fake-out. Brom gains 30 Ward.",
      },
    ],
    strongAgainst: "Nimbra, because Deluge can't wash away his stone Ward.",
    weakAgainst: "Vesh, because Soul Stealer goes straight through his Ward.",
  },
  {
    name: "Kael",
    element: "Fire",
    image: "/assets/arcade/kael.png",
    style: "Aggressive, burn damage",
    hp: 190,
    passive: {
      name: "Cinder Mantle",
      text: "Starts with a 30 point flame Ward. Hitting him while it's up gives the attacker 1 Burn, and every perfect parry restores 10 Ward.",
    },
    abilities: [
      {
        name: "Fireball",
        cost: 1,
        difficulty: "Easy",
        text: "Throws a fireball for 28 damage and 1 Burn.",
      },
      {
        name: "Molotov",
        cost: 3,
        difficulty: "Hard",
        text: "Hits for 25 and leaves a fire zone that deals 15 a turn for 3 turns and makes timing windows 20% smaller. Dodge the impact to avoid the zone completely.",
      },
      {
        name: "Meteor Shower",
        cost: 5,
        ultimate: true,
        difficulty: "Medium per meteor",
        text: "Six meteors of 18 damage each fall to an uneven rhythm, and every one has to be dodged or parried on its own. If 4 or more land, the target gets Nausea.",
      },
    ],
    strongAgainst: "Vesh, because Burn halves her healing.",
    weakAgainst: "Nimbra, because Soaked puts out his Burn.",
  },
  {
    name: "Nimbra",
    element: "Water",
    image: "/assets/arcade/nimbra.svg",
    style: "Tempo and debuffs",
    hp: 190,
    passive: {
      name: "Rain Barrier",
      text: "Starts with a 25 point water Ward. Whoever breaks it gets Soaked, and she can't be burned while it's up.",
    },
    abilities: [
      {
        name: "Tidal Lash",
        cost: 1,
        difficulty: "Medium",
        text: "A whip of water for 28 damage that leaves the target Soaked.",
      },
      {
        name: "Air Charge",
        cost: 3,
        difficulty: "Hard",
        text: "A tornado that deals 45 damage, causes Nausea and steals 1 AP from the target.",
      },
      {
        name: "Deluge",
        cost: 5,
        ultimate: true,
        difficulty: "Hard",
        text: "A flood for 85 damage, or 115 if the target is Soaked. It also washes away every magical Ward.",
      },
    ],
    strongAgainst: "Kael, because Soaked puts out Burn.",
    weakAgainst: "Brom, because Deluge can't wash away stone.",
  },
  {
    name: "Vesh",
    element: "Soul",
    image: "/assets/arcade/vesh.png",
    style: "Healing and drain",
    hp: 200,
    passive: {
      name: "Spirit Ward",
      text: "The first time she drops below half health, she gets a 50 point soul Ward and clears all her debuffs. Works once per battle.",
    },
    abilities: [
      {
        name: "Soul Mend",
        cost: 1,
        text: "Heals 30 and removes one debuff. Using it turn after turn heals less each time (30, then 20, then 10), so she can't stall forever.",
      },
      {
        name: "Blink Strike",
        cost: 2,
        difficulty: "Hard",
        text: "Teleports and hits three times for 16 from random sides. A flash and a sound show where each hit is coming from. If all three land, the target gets Nausea.",
      },
      {
        name: "Soul Stealer",
        cost: 5,
        ultimate: true,
        text: "A tether that pulses three times. Every pulse you don't parry drains about 18 HP and heals Vesh by the same amount. It ignores Wards and steals 1 AP.",
      },
    ],
    strongAgainst: "Brom, because Soul Stealer ignores his stone Ward.",
    weakAgainst: "Kael, because Burn halves her healing.",
  },
];
