module.exports=async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const {image,mimeType,product,country}=req.body||{};
    if(!image)return res.status(400).json({error:"No packaging image supplied"});
    const key=process.env.OPENAI_API_KEY;
    const demo={packaging_type:"Packaging appearance detected",likely_material:"Unverified from photo",material_confidence:"low",food_contact_likelihood:"cannot establish from photo",visible_text:[],visible_symbols:[],possible_issues:["Exact material composition cannot be verified from appearance.","Legal conformity and migration compliance cannot be established from a photograph."],missing_information:["Material specification","Packaging weight","Supplier Declaration of Compliance where applicable"],cannot_determine:["Polymer/layer composition","Migration compliance","Recyclability classification"],confidence:"low"};
    if(!key)return res.status(200).json({mode:"demo",inspection:demo});
    const prompt=`You are PackComply's preliminary AI packaging-vision assistant.
Product: ${product||"unknown"}
Destination market: ${country||"unknown"}
Inspect ONLY visible evidence. Return JSON only with keys packaging_type, likely_material, material_confidence, food_contact_likelihood, visible_text, visible_symbols, possible_issues, missing_information, cannot_determine, confidence.
Do not claim legal compliance/non-compliance. Do not infer exact polymer/layer structure, chemical composition, migration compliance, certificate validity, recyclability classification, or legal responsibility from appearance alone. Separate visible evidence from assumptions. Arrays must contain concise strings.`;
    const upstream=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:`data:${mimeType||"image/jpeg"};base64,${image}`}]}]})
    });
    const raw=await upstream.text();
    if(!upstream.ok){
      let msg=raw; try{msg=JSON.parse(raw).error?.message||raw}catch{}
      return res.status(502).json({error:"AI service error: "+msg});
    }
    const response=JSON.parse(raw), text=response.output_text||"";
    let inspection;
    try{inspection=JSON.parse(text)}catch{const m=text.match(/\{[\s\S]*\}/);if(!m)throw Error("AI returned an unreadable result.");inspection=JSON.parse(m[0])}
    res.status(200).json({mode:"live",inspection});
  }catch(e){console.error(e);res.status(500).json({error:"AI inspection function failed: "+e.message})}
}
