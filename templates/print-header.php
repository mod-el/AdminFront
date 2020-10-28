<!DOCTYPE html>

[:head]

<style type="text/css">
    body {
        background: #FFF;
    }
</style>

<script type="text/javascript">
	var adminPrefix = <?=json_encode($this->model->_AdminFront->getUrlPrefix())?>;
	window.addEventListener('load', window.print);
</script>

<div style="width: 210mm">
    <div style="padding-bottom: 10px">
		<?php
		if (file_exists(INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'logo.png')) {
			?><a href="<?= $this->model->_AdminFront->getUrlPrefix() ?>">
            <img src="<?= PATH ?>app/assets/img/logo.png" alt="" style="max-width: 30%"/></a><?php
		} else {
			?><span style="font-size: 26px"><?= entities(APP_NAME) ?></span><?php
		}
		?>
    </div>
