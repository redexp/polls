import AUTH from "../config/auth.js";

/**
 * @param {import('../models/bankid').Address[]} addresses
 * @return {import('../models/bankid').Address | null}
 */
export default function authAddress(addresses) {
	return addresses && addresses.find(addr => {
		return AUTH.addresses.some(props => {
			for (const prop in props) {
				if (props[prop].toLowerCase() !== addr[prop].toLowerCase()) {
					return false;
				}
			}

			return true;
		});
	});
}