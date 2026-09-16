export function bindRevealInput(input, onChange) {
	function handleInput(event) {
		onChange(Number(event.currentTarget.value));
	}

	input.addEventListener('input', handleInput);
	onChange(Number(input.value));

	return function unbindRevealInput() {
		input.removeEventListener('input', handleInput);
	};
}
