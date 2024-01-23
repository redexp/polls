export default function DevBankIDLoginForm() {
	let state;

	const onSubmit = () => {
		const url = new URL(location.href);

		state.value = url.searchParams.get('state') || '';
	};

	return (
		<form
			action="http://localhost:8001/oauth2/callback"
			method="post"
			class="mt-5"
			onSubmit={onSubmit}
		>
			<input type="hidden" name="state" ref={state}/>

			<div class="mb-3">
				<label class="form-label">Ідентифікаційний номер або серія і номер паспорту</label>

				<input
					name="inn"
					classList={{
						"form-control": true,
					}}
					required
				/>
			</div>

			<div class="mb-3">
				<label class="form-label">Повне імʼя</label>

				<div class="input-group">
					<input name="lastName" autocomplete="family-name" class="form-control" placeholder="Прізвище" required/>
					<input name="firstName" autocomplete="given-name" class="form-control" placeholder="Імʼя" required/>
					<input name="middleName" autocomplete="additional-name" class="form-control" placeholder="По батькові" required/>
				</div>
			</div>

			<div class="mb-3">
				<label class="form-label">Дата народження</label>

				<input
					name="birthDay"
					type="date"
					autocomplete="bday"
					classList={{
						"form-control": true,
					}}
					required
				/>
			</div>

			<div class="mb-3">
				<label class="form-label">Стать</label>

				<select
					name="sex"
					class="form-select"
				>
					<option value="M">Чоловік</option>
					<option value="F">Жінка</option>
				</select>
			</div>

			<div class="mb-3">
				<label class="form-label">Адреса реєстрації (місце проживання)</label>

				<input type="hidden" name="addresses[type]" value="juridical"/>
				<input type="hidden" name="addresses[country]" value="UA"/>

				<div class="input-group mb-2">
					<input name="addresses[state]" autocomplete="address-level1" class="form-control" placeholder="Область" required/>
					<input name="addresses[city]" autocomplete="address-level2" class="form-control" placeholder="Місто" required/>
				</div>

				<div class="input-group">
					<input name="addresses[street]" autocomplete="address-level3" class="form-control" placeholder="Назва вулиці" required/>
					<input name="addresses[houseNo]" class="form-control" placeholder="Номер будинку" required/>
					<input name="addresses[flatNo]" class="form-control" placeholder="Номер квартири"/>
				</div>
			</div>

			<div class="d-flex mt-5">
				<button
					type="submit"
					class="btn btn-primary me-2"
				>
					OK
				</button>

				<a
					href="/"
					class="btn btn-secondary"
				>
					Відмінити
				</a>
			</div>
		</form>
	);
}