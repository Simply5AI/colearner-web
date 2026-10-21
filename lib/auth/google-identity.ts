/** Request only identity evidence. A provider name/photo is not child-profile consent. */
export function googleIdentityOnly(profile:{sub:string;email?:string|null}) {return {id:profile.sub,email:profile.email??null,name:null,image:null}}
