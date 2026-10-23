import { nationFlagUrl } from '../data/nationFlags';

export function NationFlag({ id }: { id: unknown }) {
  const url = nationFlagUrl(id);
  return url ? <img className="nflag" src={url} alt="" /> : null;
}
