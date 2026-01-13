import { ILLMClient } from "../interfaces";

interface LLMInput {
  system: string;
  prompt: string;
}

/**
 * Stubbed LLM client for testing without using OpenAI tokens
 */
export class StubbedLLMClient implements ILLMClient {
  async get(input: LLMInput): Promise<string> {
    console.log("🤖 Stubbed LLM request:");
    console.log(`  System: ${input.system.slice(0, 50)}...`);
    console.log(`  Prompt length: ${input.prompt.length} chars`);

    // Return a realistic-looking stubbed response
    const stubbedResponse = `
# Instagram Performance Summary

## Top Performing Content
Based on the last week's data, video content significantly outperformed static images:
- Behind-the-scenes video: **223 engagements**, 985 reach
- Blueberry crumble post: **163 engagements**, 721 reach
- Caramel apple pie: **142 engagements**, 612 reach

## Key Insights
1. **Video content drives 37% higher engagement** than photos
2. **Product teasers** ("testing new recipes") generate strong interest
3. **Seasonal/limited offerings** create urgency and boost comments

## Recommended Posts

### Post 1: New Recipe Teaser Video
**Caption:** "👨‍🍳 Something special is baking... Can you guess what's coming next week? Drop your guesses below! 🥧✨ #PieGuys #ComingSoon #BakersLife"

**Hashtags:** #PieGuys #ComingSoon #BakersLife #FreshBaked #ArtisanPies

**Why:** Video format + teaser strategy proven to drive engagement

---

### Post 2: Limited Edition Announcement
**Caption:** "🫐 Our Blueberry Crumble is BACK but only for 2 weeks! Made with locally-sourced berries and our signature buttery crumble topping. Who's grabbing one this weekend? 💙 #PieGuys #BlueberryPie #LimitedEdition"

**Hashtags:** #PieGuys #BlueberryPie #LimitedEdition #LocalIngredients #WeekendTreats

**Why:** Limited availability creates urgency, builds on previous high performer

---

### Post 3: Customer Feature
**Caption:** "Nothing makes us happier than seeing your pie smiles! 😊 Thank you for making us part of your celebrations. Share your #PieGuys moments and we'll feature our favorites! 🥧❤️"

**Hashtags:** #PieGuys #CustomerLove #CommunityFirst #SupportLocal #PieLove

**Why:** Community engagement builds loyalty and generates user content

---

*This is a STUBBED response for testing purposes*
`;

    console.log("  ✅ Stubbed response generated");
    return stubbedResponse;
  }
}
