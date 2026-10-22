// Authored expression interactions, independently designed for Hibiki's source.
// Preserve intent channels, but do not add contradictory mouth shapes at full weight.
export function expressionWeights(p){
 const c=v=>Math.max(0,Math.min(1,v||0)),smile=c(p.smile),frown=c(p.frown),round=c(p.round);
 return {smile:smile*(1-.65*frown)*(1-.35*round),frown:frown*(1-.5*smile),round:round*(1-.35*smile),open:c(p.mouth)};
}
