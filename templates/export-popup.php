<fieldset class="pad10" style="width: 450px">
	<form action="?" method="post" onsubmit="exportPopup(2); return false" id="export-form">
		<?php
		switch ($_GET['step']) {
			case 1:
				$exportProviders = $this->model->_Admin->getExportProviders();
				if (count($exportProviders) === 0)
					die('No export provider found');
				?>
				<h2>Esportazione</h2>
				<div class="flex-fields-wrap">
					<?php
					if (count($exportProviders) > 1) {
						?>
						<div>
							Sorgente dati<br/>
							<select name="data_provider">
								<?php
								foreach ($exportProviders as $provider) {
									?>
									<option value="<?= $provider ?>"><?= entities($provider::$name) ?></option>
									<?php
								}
								?>
							</select>
						</div>
						<?php
					} else {
						?>
						<input type="hidden" name="data_provider" value="<?= $provider ?>"/>
						<?php
					}
					?>
					<div>
						Formato<br/>
						<select name="format" onchange="filterFormatOptions(this)">
							<option value="csv">CSV</option>
							<option value="xlsx">Excel</option>
							<option value="html">HTML</option>
						</select>
					</div>
					<div>
						Righe per pagina<br/>
						<input type="number" name="paginate" value="100"/>
					</div>
					<div data-format-option="csv">
						Delimitatore CSV<br/>
						<select name="delimiter">
							<option value=",">Virgola</option>
							<option value=";">Punto e virgola</option>
						</select>
					</div>
					<div>
						Tipo esportazione dati<br/>
						<select name="data_key">
							<option value="text">Testi</option>
							<option value="value">Valori</option>
						</select>
					</div>
					<div>
						<br/>
						<input type="submit" value="Genera"/>
					</div>
				</div>
				<?php
				break;
			case 2:
				?>
				<style>
					#export-loading-bar {
						margin-top: 10px;
						height: 30px;
						border: solid #2693FF 1px;
						border-radius: 5px;
					}

					#export-loading-bar > div {
						height: 30px;
						background: #2693FF;
						transition: width 0.4s ease-out;
					}

					#exporter-result {
						font-style: italic;
						padding: 10px;
					}
				</style>

				<h2>Esportazione in corso</h2>
				<div id="export-loading-bar" data-id="<?= $exportId ?>">
					<div style="width: 0%"></div>
				</div>
				<div id="exporter-result"></div>
				<?php
				break;
		}
		?>
	</form>
</fieldset>
