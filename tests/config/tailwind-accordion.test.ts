// @vitest-environment node
import { describe, it, expect } from 'vitest';

// Import the tailwind config to test its structure
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');

describe('Tailwind Accordion Configuration', () => {
  it('accordion-down keyframes are defined', () => {
    const keyframes = tailwindConfig.theme?.extend?.keyframes;
    expect(keyframes).toBeDefined();
    expect(keyframes['accordion-down']).toBeDefined();
  });

  it('accordion-up keyframes are defined', () => {
    const keyframes = tailwindConfig.theme?.extend?.keyframes;
    expect(keyframes).toBeDefined();
    expect(keyframes['accordion-up']).toBeDefined();
  });

  it('accordion-down animates height property', () => {
    const keyframes = tailwindConfig.theme?.extend?.keyframes;
    const accordionDown = keyframes['accordion-down'];

    // Verify the from state
    expect(accordionDown.from).toHaveProperty('height');
    expect(accordionDown.from.height).toBe('0');

    // Verify the to state uses radix accordion content height variable
    expect(accordionDown.to).toHaveProperty('height');
    expect(accordionDown.to.height).toBe('var(--radix-accordion-content-height)');
  });

  it('accordion-up animates height property', () => {
    const keyframes = tailwindConfig.theme?.extend?.keyframes;
    const accordionUp = keyframes['accordion-up'];

    // Verify the from state
    expect(accordionUp.from).toHaveProperty('height');
    expect(accordionUp.from.height).toBe('var(--radix-accordion-content-height)');

    // Verify the to state
    expect(accordionUp.to).toHaveProperty('height');
    expect(accordionUp.to.height).toBe('0');
  });

  it('accordion animations are defined with correct timing', () => {
    const animation = tailwindConfig.theme?.extend?.animation;
    expect(animation).toBeDefined();

    expect(animation['accordion-down']).toBe('accordion-down 0.2s ease-out');
    expect(animation['accordion-up']).toBe('accordion-up 0.2s ease-out');
  });
});
