import {describe,it,expect} from 'vitest';
import {calculateDemand,principalKobo} from './demand';
describe('Demand Notice rule 1',()=>{
  it('applies the fixed penalty and interest once, with no development levy',()=>{
    expect(calculateDemand('1,000.00')).toEqual({principal:'1,000.00',penalty:'100.00',interest:'231.00',total:'1,331.00'});
  });
  it('rounds upward at each step and uses the rounded penalty for interest',()=>{
    expect(calculateDemand('0.01')).toEqual({principal:'0.01',penalty:'0.01',interest:'0.01',total:'0.03'});
    expect(calculateDemand('1.01')).toEqual({principal:'1.01',penalty:'0.11',interest:'0.24',total:'1.36'});
    expect(calculateDemand('0.39')).toEqual({principal:'0.39',penalty:'0.04',interest:'0.10',total:'0.53'});
  });
  it('keeps exact cents and large amounts without floating point errors',()=>{
    expect(calculateDemand('000001.10')).toEqual({principal:'1.10',penalty:'0.11',interest:'0.26',total:'1.47'});
    expect(calculateDemand('0')).toEqual({principal:'0.00',penalty:'0.00',interest:'0.00',total:'0.00'});
    expect(principalKobo('9007199254740993.01')).toBe(900719925474099301n);
    expect(calculateDemand('9007199254740993.01')).toEqual({principal:'9,007,199,254,740,993.01',penalty:'900,719,925,474,099.31',interest:'2,080,663,027,845,169.39',total:'11,988,582,208,060,261.71'});
  });
  it('rejects missing, ambiguous, negative and fractional-kobo input',()=>{
    for(const input of ['',' ','NIL','-1','1e3','NaN','Infinity','12,34','1,000,00','1.001','₦100','1 000','<script>','9'.repeat(301)])expect(()=>calculateDemand(input)).toThrow();
  });
});
