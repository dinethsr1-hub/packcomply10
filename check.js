const RULES = require("../rules.json");
const DATA = require("../data.json");

function matches(rule,x){
  const t=rule.trigger||{};
  if(t.countries && !t.countries.includes(x.country)) return false;
  if(t.origin && t.origin!==x.origin) return false;
  if(t.products && !t.products.includes(x.product)) return false;
  if(t.food_contact && t.food_contact!==x.food_contact) return false;
  if(t.b2c && t.b2c!==x.b2c) return false;
  if(t.foreign_direct && t.foreign_direct!==x.foreign_direct) return false;
  if(t.material && !t.material.includes(x.material)) return false;
  if(t.product_groups && !t.product_groups.includes(x.product_group)) return false;
  return true;
}
function unique(a){return [...new Set(a)]}
function readiness(x,matched,issues){
  let score=100;
  if(!x.product)score-=20;
  if(!x.country)score-=20;
  if(!x.material)score-=10;
  if(x.food_contact==="unknown")score-=8;
  if(x.b2c==="unknown")score-=5;
  if(x.mass==="unknown")score-=8;
  if(x.origin==="unknown")score-=8;
  if(x.hs_code&&!/^\d{4,10}$/.test(x.hs_code))score-=5;
  score-=Math.min(25,issues.filter(i=>i.level==="high").length*8);
  score-=Math.min(15,issues.filter(i=>i.level==="medium").length*3);
  return Math.max(0,Math.min(100,score));
}
module.exports=async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const x=req.body||{};
    const product=DATA.catalog.products.find(p=>p.id===x.product);
    const matched=RULES.filter(r=>matches(r,x));
    const coverage=DATA.coverage[x.country]||{status:"not_loaded",label:"No verified country rules loaded"};
    const productName=product?.name||x.product||"Unknown product";
    const issues=[], evidence=unique(matched.flatMap(r=>r.evidence||[]));
    const high=matched.filter(r=>r.priority==="high").length;
    const groups=unique(matched.map(r=>r.type));
    if(!x.product||!x.country||!x.material)issues.push({level:"high",text:"Complete the product, destination and packaging fields."});
    if(x.food_contact==="yes")issues.push({level:"medium",text:"Food-contact suitability must be supported by supplier technical documentation; a photograph cannot prove conformity."});
    if(["plastic","composite"].includes(x.material))issues.push({level:"medium",text:"Exact polymer/layer structure and migration performance cannot be established from appearance alone."});
    if(x.mass==="unknown")issues.push({level:"medium",text:"Packaging mass is missing. Obtain weight by material in kg for packaging/EPR assessment."});
    if(x.origin==="unknown")issues.push({level:"medium",text:"Country of origin is not specified. Some import controls are origin-specific."});
    if(x.b2c==="yes"&&["Germany","United Kingdom"].includes(x.country))issues.push({level:"medium",text:`Check ${x.country} packaging producer/EPR obligations for the actual supply-chain role.`});
    if(coverage.status!=="verified")issues.push({level:"high",text:"This destination is in the workflow catalog, but verified country-specific rules are not yet loaded. Do not treat this result as a full compliance determination."});
    if(matched.length===0)issues.push({level:"high",text:"No verified rule matched this exact product/destination profile. The absence of a match does not mean the shipment is compliant."});
    if(x.hs_code&&!/^\d{4,10}$/.test(x.hs_code))issues.push({level:"medium",text:"HS/CN code format looks incomplete. Confirm the exact tariff classification before relying on commodity-specific controls."});
    let risk="LOW";
    if(coverage.status!=="verified"||matched.length===0||issues.some(i=>i.level==="high"))risk="HIGH";
    else if(high>=2||issues.length>=3)risk="MEDIUM";
    const status=risk==="HIGH"?"CHECK REQUIRED":risk==="MEDIUM"?"REVIEW REQUIRED":"PRELIMINARY SCREEN PASSED";
    res.status(200).json({
      status,risk,readiness_score:readiness(x,matched,issues),coverage,
      profile:{product:productName,country:x.country,origin:x.origin||"unknown",hs_code:x.hs_code||"not supplied",packaging:x.material,food_contact:x.food_contact,b2c:x.b2c},
      rule_summary:{count:matched.length,high_priority:high,areas:groups},
      matched,evidence,issues,
      limitations:[
        "This is a preliminary screening tool, not legal advice, certification or a binding compliance determination.",
        "Regulatory applicability can depend on HS/CN code, formulation, origin, importer role, intended use, sales channel and current law.",
        "A matched rule means the topic is relevant for review; it does not mean the product is compliant.",
        "Country coverage is a starter dataset and must be expanded and maintained against official sources before commercial reliance."
      ]
    });
  }catch(e){console.error(e);res.status(500).json({error:"Compliance check function failed: "+e.message})}
}
