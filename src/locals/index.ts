import pagination from './pagination.json';
import response from './response.json';
import error from './error.json';
import logging from './logging.json';
import auth from './auth.json';
import fcm from './fcm.json';
import files from './files.json';
import organizations from './organizations.json';
import memberships from './memberships.json';
import drivers from './drivers.json';
import subscriptions from './subscriptions.json';
import attorneys from './attorneys.json';
import cases from './cases.json';
import vault from './vault.json';
import sos from './sos.json';
import location from './location.json';
import users from './users.json';
import notifications from './notifications.json';
import maintainers from './maintainers.json';
import legal from './legal.json';
import templates from './templates.json';
import fleets from './fleets.json';
import hazards from './hazards.json';

type LocaleValue = string | { [key: string]: LocaleValue };
type LocaleObject = Record<string, LocaleValue>;

function withFallback<T extends LocaleObject>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop: string): LocaleValue {
      const value = target[prop];
      if (value !== undefined) {
        return typeof value === 'object' ? withFallback(value) : value;
      }

      return prop;
    },
  });
}

export default withFallback({
  pagination,
  response,
  error,
  logging,
  auth,
  fcm,
  files,
  organizations,
  memberships,
  drivers,
  subscriptions,
  attorneys,
  cases,
  vault,
  sos,
  location,
  users,
  notifications,
  maintainers,
  legal,
  templates,
  fleets,
  hazards,
});
