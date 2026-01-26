import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('Style spread test', () => {
  it('should spread undefined style correctly', () => {
    const style1 = { paddingLeft: '8px', ...undefined };
    const style2 = { paddingLeft: '8px', ...(undefined || {}) };
    
    console.log('Style1:', style1);
    console.log('Style2:', style2);
    
    expect(style1).toEqual({ paddingLeft: '8px' });
    expect(style2).toEqual({ paddingLeft: '8px' });
  });
  
  it('should spread style object correctly', () => {
    const customStyle = { backgroundColor: 'red' };
    const style1 = { paddingLeft: '8px', ...customStyle };
    const style2 = { paddingLeft: '8px', ...(customStyle || {}) };
    
    console.log('Style1 with custom:', style1);
    console.log('Style2 with custom:', style2);
    
    expect(style1).toEqual({ paddingLeft: '8px', backgroundColor: 'red' });
    expect(style2).toEqual({ paddingLeft: '8px', backgroundColor: 'red' });
  });
});
