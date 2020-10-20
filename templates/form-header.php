<form action="" method="post" id="adminForm" name="adminForm" onsubmit="save(); return false" data-filled="0">
	<!-- fake fields are a workaround for chrome autofill getting the wrong fields -->
	<input style="position:absolute;top:-1000px" type="text" name="fakeusernameremembered"/>
	<input style="position:absolute;top:-1000px" type="password" name="fakepasswordremembered"/>

	<input type="hidden" name="_model_version" value="1"/>
	<?php /* TODO
	<input type="hidden" name="_mandatory_fields" value="<?= entities(json_encode($this->model->_Admin->getPageOptions()['required'])) ?>"/>
 */ ?>
