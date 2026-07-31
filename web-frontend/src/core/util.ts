export function toTypeId(state:number):number{
    return (state >> 24) & 0xFF;
}